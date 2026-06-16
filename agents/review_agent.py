from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from .shared_schema import CaseMessage, ReviewMessage
from storage.queue_engine import PendingCase, load_pending_cases, rank_pending_cases

logger = logging.getLogger(__name__)
DEFAULT_HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.65


class ReviewState(TypedDict, total=False):
    case: CaseMessage
    queue_snapshot: list[PendingCase]
    combined_queue: list[dict[str, Any]]
    nearby_cases: list[dict[str, Any]]
    clinical_risk: str
    confidence: float
    proposed_rank: int | None
    queue_assessment: str
    queue_action: str
    affected_case_ids: list[str]
    needs_human_review: bool
    recommended_next_route: str
    summary: str
    review_reasoning_summary: str
    validation_issues: list[str]
    result: ReviewMessage


def review_case(case: CaseMessage) -> ReviewMessage:
    logger.info("REVIEW_CASE_RECEIVED case_id=%s patient_code=%s", case.case_id, case.patient_code)
    graph = build_review_graph()
    state = graph.invoke({"case": case})
    return state["result"]


def build_review_graph():
    graph = StateGraph(ReviewState)
    graph.add_node("ingest_case", ingest_case)
    graph.add_node("load_queue_snapshot", load_queue_snapshot_node)
    graph.add_node("assess_clinical_risk", assess_clinical_risk)
    graph.add_node("assess_queue_position", assess_queue_position)
    graph.add_node("decide_recommendation", decide_recommendation)
    graph.add_node("emit_structured_result", emit_structured_result)

    graph.set_entry_point("ingest_case")
    graph.add_edge("ingest_case", "load_queue_snapshot")
    graph.add_edge("load_queue_snapshot", "assess_clinical_risk")
    graph.add_edge("assess_clinical_risk", "assess_queue_position")
    graph.add_edge("assess_queue_position", "decide_recommendation")
    graph.add_edge("decide_recommendation", "emit_structured_result")
    graph.add_edge("emit_structured_result", END)
    return graph.compile()


def ingest_case(state: ReviewState) -> ReviewState:
    case = state["case"]
    validation_issues: list[str] = []
    if case.validation_status != "valid":
        validation_issues.append(f"validation_status={case.validation_status}")
    if case.missing_fields:
        validation_issues.append("missing_fields=" + ",".join(case.missing_fields))
    if validation_issues:
        logger.warning(
            "REVIEW_VALIDATION_ISSUES case_id=%s issues=%s",
            case.case_id,
            validation_issues,
        )
    state["validation_issues"] = validation_issues
    return state


def load_queue_snapshot_node(state: ReviewState) -> ReviewState:
    case = state["case"]
    snapshot = [
        pending_case
        for pending_case in load_pending_cases()
        if pending_case.case_id != case.case_id
    ]
    state["queue_snapshot"] = snapshot
    logger.info(
        "REVIEW_QUEUE_SNAPSHOT_LOADED case_id=%s pending_count=%s",
        case.case_id,
        len(snapshot),
    )
    return state


def assess_clinical_risk(state: ReviewState) -> ReviewState:
    case = state["case"]
    signals: list[str] = []

    if case.critical_status == 1:
        signals.append("critical_status")
    if case.stupor_status not in (None, 0):
        signals.append("stupor_status")
    if case.avpu and case.avpu.upper() != "A":
        signals.append("altered_avpu")
    if case.spo2 is not None and case.spo2 < 92:
        signals.append("low_spo2")
    if case.bp_systolic is not None and case.bp_systolic < 90:
        signals.append("hypotension")
    if case.pulse_rate is not None and (case.pulse_rate < 40 or case.pulse_rate >= 130):
        signals.append("abnormal_pulse")
    if case.respiratory_rate is not None and (
        case.respiratory_rate <= 8 or case.respiratory_rate >= 30
    ):
        signals.append("abnormal_respiratory_rate")
    if case.triage_grade is not None and case.triage_grade <= 2:
        signals.append("high_acuity_triage_grade")
    if case.pain_grade is not None and case.pain_grade >= 8:
        signals.append("severe_pain")

    if case.critical_status == 1 or len(signals) >= 3:
        risk = "CRITICAL"
    elif signals or case.urgency_score >= 8:
        risk = "HIGH"
    elif case.urgency_score >= 4 or (case.pain_grade is not None and case.pain_grade >= 5):
        risk = "MEDIUM"
    else:
        risk = "LOW"

    confidence = 0.92
    if state.get("validation_issues"):
        confidence -= 0.18
    confidence -= min(len(case.missing_fields), 6) * 0.03
    if case.urgency_score >= 8 or signals:
        confidence += 0.04
    state["clinical_risk"] = risk
    state["confidence"] = round(max(0.35, min(confidence, 0.98)), 2)
    state["review_reasoning_summary"] = _reasoning_summary(case, risk, signals)
    return state


def assess_queue_position(state: ReviewState) -> ReviewState:
    case = state["case"]
    snapshot = state.get("queue_snapshot", [])
    incoming = _pending_case_from_message(case)
    old_ranks = {pending.case_id: pending.queue_rank for pending in snapshot}
    combined = rank_pending_cases([*snapshot, incoming])
    proposed = next(item for item in combined if item["case_id"] == case.case_id)
    proposed_rank = int(proposed["queue_rank"])
    new_ranks = {
        item["case_id"]: item["queue_rank"]
        for item in combined
        if item["case_id"] != case.case_id
    }
    affected_case_ids = [
        case_id
        for case_id, new_rank in sorted(new_ranks.items(), key=lambda item: item[1])
        if old_ranks.get(case_id) != new_rank
    ]
    nearby_cases = _nearby_cases(combined, case.case_id)

    if not snapshot:
        queue_assessment = "APPROPRIATE"
    elif proposed_rank == 1:
        queue_assessment = "UNDER_RANKED"
    elif affected_case_ids:
        queue_assessment = "UNDER_RANKED"
    else:
        queue_assessment = "APPROPRIATE"

    state["combined_queue"] = combined
    state["nearby_cases"] = nearby_cases
    state["proposed_rank"] = proposed_rank
    state["affected_case_ids"] = affected_case_ids
    state["queue_assessment"] = queue_assessment
    logger.info(
        "REVIEW_QUEUE_COMPARISON_PERFORMED case_id=%s proposed_rank=%s affected_case_ids=%s nearby_case_ids=%s",
        case.case_id,
        proposed_rank,
        affected_case_ids,
        [item["case_id"] for item in nearby_cases],
    )
    return state


def decide_recommendation(state: ReviewState) -> ReviewState:
    case = state["case"]
    clinical_risk = state["clinical_risk"]
    confidence = float(state["confidence"])
    confidence_threshold = _human_review_confidence_threshold()
    needs_human_review = (
        case.force_escalation
        or clinical_risk == "CRITICAL"
        or confidence < confidence_threshold
        or case.validation_status != "valid"
    )
    if needs_human_review:
        queue_action = "escalate"
        queue_assessment = "NEEDS_HUMAN_REVIEW"
        next_route = "human_review"
    else:
        queue_action = "insert"
        queue_assessment = state["queue_assessment"]
        next_route = "final_result"

    state["needs_human_review"] = needs_human_review
    state["queue_action"] = queue_action
    state["queue_assessment"] = queue_assessment
    state["recommended_next_route"] = next_route
    logger.info(
        "REVIEW_ROUTE_DECISION case_id=%s queue_action=%s next_route=%s needs_human_review=%s confidence_threshold=%s",
        case.case_id,
        queue_action,
        next_route,
        needs_human_review,
        confidence_threshold,
    )
    return state


def emit_structured_result(state: ReviewState) -> ReviewState:
    case = state["case"]
    result = ReviewMessage(
        case_id=case.case_id,
        patient_code=case.patient_code,
        clinical_risk=state["clinical_risk"],  # type: ignore[arg-type]
        confidence=state["confidence"],
        queue_assessment=state["queue_assessment"],  # type: ignore[arg-type]
        proposed_rank=state["proposed_rank"],
        queue_action=state["queue_action"],  # type: ignore[arg-type]
        affected_case_ids=state["affected_case_ids"],
        needs_human_review=state["needs_human_review"],
        summary=_summary(state),
        recommended_next_route=state["recommended_next_route"],  # type: ignore[arg-type]
        review_reasoning_summary=state["review_reasoning_summary"],
    )
    state["result"] = result
    logger.info(
        "REVIEW_COMPLETED case_id=%s clinical_risk=%s proposed_rank=%s queue_action=%s",
        case.case_id,
        result.clinical_risk,
        result.proposed_rank,
        result.queue_action,
    )
    return state


def _pending_case_from_message(case: CaseMessage) -> PendingCase:
    now = datetime.now(timezone.utc).isoformat()
    return PendingCase(
        case_id=case.case_id,
        patient_code=case.patient_code,
        status="routed",
        payload=case.model_dump(),
        created_at=now,
        updated_at=now,
        priority_score=None,
        queue_rank=None,
        previous_rank=None,
        rank_change=None,
        queue_version=None,
        manual_priority_override=None,
    )


def _nearby_cases(
    combined_queue: list[dict[str, Any]],
    case_id: str,
    *,
    window: int = 2,
) -> list[dict[str, Any]]:
    index = next(
        idx for idx, item in enumerate(combined_queue) if item["case_id"] == case_id
    )
    start = max(0, index - window)
    end = min(len(combined_queue), index + window + 1)
    return [
        item
        for item in combined_queue[start:end]
        if item["case_id"] != case_id
    ]


def _reasoning_summary(case: CaseMessage, risk: str, signals: list[str]) -> str:
    pieces = [f"risk={risk}", f"urgency_score={case.urgency_score}"]
    if signals:
        pieces.append("signals=" + ",".join(signals[:5]))
    if case.missing_fields:
        pieces.append("missing_fields=" + ",".join(case.missing_fields[:5]))
    return "; ".join(pieces)


def _summary(state: ReviewState) -> str:
    case = state["case"]
    nearby = state.get("nearby_cases", [])
    above = [
        item["case_id"]
        for item in nearby
        if item.get("queue_rank") is not None
        and state.get("proposed_rank") is not None
        and item["queue_rank"] < state["proposed_rank"]
    ]
    below = [
        item["case_id"]
        for item in nearby
        if item.get("queue_rank") is not None
        and state.get("proposed_rank") is not None
        and item["queue_rank"] > state["proposed_rank"]
    ]
    if state["needs_human_review"]:
        return (
            f"Case {case.case_id} requires human review before queue placement; "
            f"provisional rank {state['proposed_rank']} based on current queue."
        )
    return (
        f"Case {case.case_id} is recommended for insertion at rank {state['proposed_rank']} "
        f"after comparison with nearby cases above={above} below={below}."
    )


def _human_review_confidence_threshold() -> float:
    raw_value = os.getenv("CT_REVIEW_CONFIDENCE_THRESHOLD")
    if raw_value is None or not raw_value.strip():
        return DEFAULT_HUMAN_REVIEW_CONFIDENCE_THRESHOLD
    try:
        threshold = float(raw_value)
    except ValueError:
        logger.warning(
            "Invalid CT_REVIEW_CONFIDENCE_THRESHOLD=%r; using default %s",
            raw_value,
            DEFAULT_HUMAN_REVIEW_CONFIDENCE_THRESHOLD,
        )
        return DEFAULT_HUMAN_REVIEW_CONFIDENCE_THRESHOLD
    return max(0.0, min(threshold, 1.0))
