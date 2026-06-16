from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .db import get_connection, get_db_path, init_db

logger = logging.getLogger(__name__)

PAYLOAD_FIELD_MAP = {
    "case_id": ("case_id", "triage_code"),
    "patient_code": ("patient_code", "PatientCode"),
    "triage_code": ("triage_code",),
    "pain_grade": ("pain_grade", "PainGrade"),
    "critical_status": ("critical_status", "CriticalStatus"),
    "stupor_status": ("stupor_status", "StuporStatus"),
    "spo2": ("spo2", "O2Saturation"),
    "avpu": ("avpu", "AVPU"),
    "triage_grade": ("triage_grade", "TriageGrade"),
    "urgency_score": ("urgency_score",),
    "waiting_time_minutes": ("waiting_time_minutes",),
    "manual_priority_override": ("manual_priority_override", "priority_override"),
}
NUMERIC_FIELDS = {
    "pain_grade",
    "critical_status",
    "stupor_status",
    "spo2",
    "triage_grade",
    "urgency_score",
    "waiting_time_minutes",
    "manual_priority_override",
}


@dataclass(frozen=True)
class PendingCase:
    case_id: str
    patient_code: str | None
    status: str
    payload: dict[str, Any]
    created_at: str
    updated_at: str
    priority_score: float | None
    queue_rank: int | None
    previous_rank: int | None
    rank_change: int | None
    queue_version: int | None
    manual_priority_override: float | None


def load_pending_cases(db_path: Path | None = None) -> list[PendingCase]:
    init_db(db_path)
    with get_connection(db_path or get_db_path()) as connection:
        rows = connection.execute(
            """
            SELECT
                case_id,
                patient_code,
                status,
                payload,
                created_at,
                updated_at,
                priority_score,
                queue_rank,
                previous_rank,
                rank_change,
                queue_version,
                manual_priority_override
            FROM cases
            WHERE status = 'pending'
            ORDER BY created_at ASC, case_id ASC
            """
        ).fetchall()

    cases = [_row_to_pending_case(row) for row in rows]
    logger.info("QUEUE_CASES_LOADED pending_count=%s", len(cases))
    return cases


def compute_priority_score(case_row: PendingCase) -> float:
    normalized = _extract_priority_inputs(case_row)
    override = normalized["manual_priority_override"]
    if override is not None:
        return round(float(override), 3)

    score = 0.0
    score += 25.0 if normalized["critical_status"] == 1 else 0.0
    score += 15.0 if normalized["stupor_status"] not in (None, 0) else 0.0
    score += float(normalized["urgency_score"] or 0) * 3.0

    triage_grade = normalized["triage_grade"]
    if triage_grade is not None:
        score += max(0, 6 - triage_grade) * 2.0

    spo2 = normalized["spo2"]
    if spo2 is not None:
        if spo2 < 90:
            score += 10.0
        elif spo2 < 92:
            score += 8.0
        elif spo2 < 95:
            score += 3.0

    avpu = (normalized["avpu"] or "").upper()
    if avpu and avpu != "A":
        score += 6.0

    pain_grade = normalized["pain_grade"]
    if pain_grade is not None:
        if pain_grade >= 8:
            score += 4.0
        elif pain_grade >= 5:
            score += 2.0

    waiting_time_minutes = normalized["waiting_time_minutes"] or 0
    score += min(waiting_time_minutes, 360) / 15.0

    score -= _missing_data_penalty(normalized)
    return round(score, 3)


def rank_pending_cases(cases: list[PendingCase]) -> list[dict[str, Any]]:
    ranked_cases: list[dict[str, Any]] = []
    for case in cases:
        priority_score = compute_priority_score(case)
        normalized = _extract_priority_inputs(case)
        ranked_cases.append(
            {
                "case_id": case.case_id,
                "patient_code": case.patient_code,
                "status": case.status,
                "created_at": case.created_at,
                "updated_at": case.updated_at,
                "previous_rank": case.queue_rank,
                "priority_score": priority_score,
                "priority_inputs": normalized,
            }
        )

    ranked_cases.sort(
        key=lambda case: (
            -case["priority_score"],
            -int(case["priority_inputs"]["urgency_score"] or 0),
            _sort_wait_minutes(case["priority_inputs"]["waiting_time_minutes"]),
            case["created_at"],
            case["case_id"],
        )
    )

    for index, case in enumerate(ranked_cases, start=1):
        previous_rank = case["previous_rank"]
        case["queue_rank"] = index
        case["rank_change"] = (
            None if previous_rank is None else previous_rank - index
        )
    return ranked_cases


def recompute_queue(
    *,
    db_path: Path | None = None,
    reason: str = "manual_recompute",
    trigger_case_id: str | None = None,
) -> dict[str, Any]:
    cases = load_pending_cases(db_path)
    old_ranks = {case.case_id: case.queue_rank for case in cases}
    ranked_cases = rank_pending_cases(cases)
    new_ranks = {case["case_id"]: case["queue_rank"] for case in ranked_cases}
    affected_cases = get_affected_cases(old_ranks, new_ranks)

    init_db(db_path)
    with get_connection(db_path or get_db_path()) as connection:
        queue_version = _next_queue_version(connection)
        for case in cases:
            _log_event(
                connection,
                queue_version=queue_version,
                event_type="case_loaded",
                case_id=case.case_id,
                details={
                    "status": case.status,
                    "current_rank": case.queue_rank,
                },
            )
        update_case_ranks(
            ranked_cases,
            queue_version=queue_version,
            connection=connection,
        )
        _log_event(
            connection,
            queue_version=queue_version,
            event_type="queue_recomputed",
            case_id=trigger_case_id,
            details={
                "reason": reason,
                "pending_count": len(ranked_cases),
                "affected_count": len(affected_cases),
            },
        )
        for case_id in affected_cases:
            updated_case = next(
                case for case in ranked_cases if case["case_id"] == case_id
            )
            _log_event(
                connection,
                queue_version=queue_version,
                event_type="rank_changed",
                case_id=case_id,
                details={
                    "reason": reason,
                    "previous_rank": old_ranks.get(case_id),
                    "queue_rank": updated_case["queue_rank"],
                    "rank_change": updated_case["rank_change"],
                    "priority_score": updated_case["priority_score"],
                },
            )
        if affected_cases:
            _log_event(
                connection,
                queue_version=queue_version,
                event_type="affected_cases",
                case_id=trigger_case_id,
                details={
                    "reason": reason,
                    "case_ids": affected_cases,
                },
            )
        connection.commit()

    logger.info(
        "QUEUE_RECOMPUTED version=%s pending_count=%s affected_count=%s trigger_case_id=%s reason=%s",
        queue_version,
        len(ranked_cases),
        len(affected_cases),
        trigger_case_id or "none",
        reason,
    )
    return {
        "queue_version": queue_version,
        "pending_count": len(ranked_cases),
        "affected_cases": affected_cases,
        "queue": ranked_cases,
    }


def update_case_ranks(
    ranked_cases: list[dict[str, Any]],
    *,
    queue_version: int,
    connection: Any | None = None,
    db_path: Path | None = None,
) -> None:
    owns_connection = connection is None
    if owns_connection:
        init_db(db_path)
        connection = get_connection(db_path or get_db_path())

    try:
        for case in ranked_cases:
            connection.execute(
                """
                UPDATE cases
                SET priority_score = ?,
                    previous_rank = queue_rank,
                    queue_rank = ?,
                    rank_change = ?,
                    queue_version = ?,
                    updated_at = ?
                WHERE case_id = ?
                """,
                (
                    case["priority_score"],
                    case["queue_rank"],
                    case["rank_change"],
                    queue_version,
                    _now(),
                    case["case_id"],
                ),
            )
        if owns_connection:
            connection.commit()
    finally:
        if owns_connection:
            connection.close()


def get_queue_snapshot(
    case_id: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    init_db(db_path)
    query = """
        SELECT
            case_id,
            patient_code,
            status,
            priority_score,
            queue_rank,
            previous_rank,
            rank_change,
            queue_version,
            created_at,
            updated_at
        FROM cases
        WHERE status = 'pending'
    """
    params: tuple[Any, ...] = ()
    if case_id is not None:
        query += " AND case_id = ?"
        params = (case_id,)
    query += " ORDER BY queue_rank ASC, created_at ASC, case_id ASC"

    with get_connection(db_path or get_db_path()) as connection:
        rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def get_case_queue_context(
    case_id: str,
    db_path: Path | None = None,
) -> dict[str, Any] | None:
    init_db(db_path)
    with get_connection(db_path or get_db_path()) as connection:
        row = connection.execute(
            """
            SELECT
                case_id,
                status,
                priority_score,
                queue_rank,
                previous_rank,
                rank_change,
                queue_version,
                updated_at
            FROM cases
            WHERE case_id = ?
            """,
            (case_id,),
        ).fetchone()
    return dict(row) if row is not None else None


def get_affected_cases(
    old_ranks: dict[str, int | None],
    new_ranks: dict[str, int | None],
) -> list[str]:
    affected_case_ids: list[str] = []
    for case_id in sorted(set(old_ranks) | set(new_ranks)):
        if old_ranks.get(case_id) == new_ranks.get(case_id):
            continue
        affected_case_ids.append(case_id)
    return affected_case_ids


def _row_to_pending_case(row: Any) -> PendingCase:
    return PendingCase(
        case_id=row["case_id"],
        patient_code=row["patient_code"],
        status=row["status"],
        payload=json.loads(row["payload"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        priority_score=row["priority_score"],
        queue_rank=row["queue_rank"],
        previous_rank=row["previous_rank"],
        rank_change=row["rank_change"],
        queue_version=row["queue_version"],
        manual_priority_override=row["manual_priority_override"],
    )


def _extract_priority_inputs(case_row: PendingCase) -> dict[str, Any]:
    payload = case_row.payload
    normalized: dict[str, Any] = {}
    for field_name, keys in PAYLOAD_FIELD_MAP.items():
        value = _first_present(payload, keys)
        if field_name == "manual_priority_override" and case_row.manual_priority_override is not None:
            value = case_row.manual_priority_override
        elif field_name == "waiting_time_minutes" and value is None:
            value = _compute_waiting_time_minutes(payload, case_row.created_at)
        elif field_name == "urgency_score" and value is None:
            value = _compute_urgency_score(payload)
        if field_name in NUMERIC_FIELDS:
            normalized[field_name] = _as_number(value)
        else:
            normalized[field_name] = _as_clean_string(value)

    normalized["waiting_time_minutes"] = (
        int(normalized["waiting_time_minutes"])
        if normalized["waiting_time_minutes"] is not None
        else _compute_waiting_time_minutes(payload, case_row.created_at)
    )
    normalized["urgency_score"] = (
        int(normalized["urgency_score"])
        if normalized["urgency_score"] is not None
        else _compute_urgency_score(payload)
    )
    return normalized


def _compute_urgency_score(payload: dict[str, Any]) -> int:
    critical_status = _as_number(_first_present(payload, PAYLOAD_FIELD_MAP["critical_status"]))
    stupor_status = _as_number(_first_present(payload, PAYLOAD_FIELD_MAP["stupor_status"]))
    avpu = (_as_clean_string(_first_present(payload, PAYLOAD_FIELD_MAP["avpu"])) or "").upper()
    triage_grade = _as_number(_first_present(payload, PAYLOAD_FIELD_MAP["triage_grade"]))
    pain_grade = _as_number(_first_present(payload, PAYLOAD_FIELD_MAP["pain_grade"]))
    spo2 = _as_number(_first_present(payload, PAYLOAD_FIELD_MAP["spo2"]))

    score = 0
    if critical_status == 1:
        score += 5
    if stupor_status not in (None, 0):
        score += 4
    if avpu and avpu != "A":
        score += 2
    if triage_grade is not None:
        if triage_grade <= 2:
            score += 3
        elif triage_grade == 3:
            score += 2
        elif triage_grade >= 4:
            score += 1
    if pain_grade is not None:
        if pain_grade >= 7:
            score += 2
        elif pain_grade >= 4:
            score += 1
    if spo2 is not None:
        if spo2 < 92:
            score += 3
        elif spo2 < 95:
            score += 1
    return min(score, 15)


def _compute_waiting_time_minutes(payload: dict[str, Any], created_at: str) -> int | None:
    now = datetime.now(timezone.utc)
    candidates = (
        payload.get("waiting_time_minutes"),
        payload.get("dispatched_at"),
        payload.get("queued_at"),
        payload.get("created_at"),
        created_at,
    )
    first_candidate = candidates[0]
    if first_candidate not in (None, ""):
        direct_minutes = _as_number(first_candidate)
        if direct_minutes is not None:
            return max(0, int(direct_minutes))

    for candidate in candidates[1:]:
        parsed = _parse_datetime(candidate)
        if parsed is None:
            continue
        return max(0, int((now - parsed).total_seconds() // 60))
    return None


def _missing_data_penalty(normalized: dict[str, Any]) -> float:
    penalty = 0.0
    if normalized.get("patient_code") in (None, ""):
        penalty += 20.0
    for field_name in ("critical_status", "stupor_status", "urgency_score", "triage_grade", "spo2", "avpu"):
        if normalized.get(field_name) in (None, ""):
            penalty += 1.5
    return penalty


def _next_queue_version(connection: Any) -> int:
    row = connection.execute(
        "SELECT COALESCE(MAX(queue_version), 0) + 1 AS next_version FROM cases"
    ).fetchone()
    return int(row["next_version"])


def _log_event(
    connection: Any,
    *,
    queue_version: int,
    event_type: str,
    case_id: str | None,
    details: dict[str, Any],
) -> None:
    connection.execute(
        """
        INSERT INTO queue_events (
            queue_version,
            event_type,
            case_id,
            details,
            created_at
        ) VALUES (?, ?, ?, ?, ?)
        """,
        (
            queue_version,
            event_type,
            case_id,
            json.dumps(details, sort_keys=True),
            _now(),
        ),
    )


def _first_present(payload: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in payload:
            return payload[key]
    return None


def _as_clean_string(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _as_number(value: Any) -> int | float | None:
    cleaned = _as_clean_string(value)
    if cleaned is None:
        return None
    number = float(cleaned)
    if number.is_integer():
        return int(number)
    return number


def _parse_datetime(value: Any) -> datetime | None:
    cleaned = _as_clean_string(value)
    if cleaned is None:
        return None
    candidate = cleaned.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _sort_wait_minutes(waiting_time_minutes: Any) -> int:
    if waiting_time_minutes is None:
        return 0
    return -int(waiting_time_minutes)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
