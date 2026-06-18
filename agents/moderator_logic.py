from __future__ import annotations

from typing import Any, Sequence

from .moderator_schema import PlacementAction, QueueContextItem
from .pairwise_comparator import PairwiseCase
from .review_schema import ClinicalUrgencyMessage
from .router_logic import normalize_case_payload, to_case_message
from storage.queue_store import CaseRecord


def queue_context_item(snapshot_item: dict[str, Any]) -> QueueContextItem:
    queue_position = snapshot_item.get("queue_position")
    if queue_position is None:
        raise ValueError("queue snapshot item is missing queue_position")
    return QueueContextItem(
        case_id=str(snapshot_item["case_id"]),
        patient_code=_string_or_none(snapshot_item.get("patient_code")),
        queue_position=int(queue_position),
        waiting_ticks=_int_or_none(snapshot_item.get("waiting_ticks")),
    )


def pairwise_case_from_record(
    record: CaseRecord,
    *,
    queue_position: int | None,
    waiting_ticks: int | None,
) -> PairwiseCase:
    normalized = normalize_case_payload(record.payload, record=record)
    case_message = to_case_message(normalized)
    return PairwiseCase.model_validate(
        {
            **case_message.model_dump(),
            "queue_position": queue_position,
            "waiting_ticks": waiting_ticks,
        }
    )


def needs_human_review(case: PairwiseCase, clinical: ClinicalUrgencyMessage) -> bool:
    if case.force_escalation:
        return True
    if case.validation_status != "valid":
        return True
    if clinical.confidence < 0.55:
        return True
    return False


def placement_from_insertion_index(
    *,
    insertion_index: int,
    queue_cases: Sequence[PairwiseCase],
) -> tuple[PlacementAction, str | None]:
    if not queue_cases or insertion_index <= 0:
        return "go_to_top", None
    if insertion_index >= len(queue_cases):
        return "go_to_bottom", None
    return "insert_before", queue_cases[insertion_index].case_id


def reason_summary(
    *,
    clinical: ClinicalUrgencyMessage,
    placement_action: PlacementAction,
    anchor_case_id: str | None,
    comparison_count: int,
    needs_review: bool,
    pairwise_failure: str | None,
) -> str:
    pieces = [
        f"clinical_urgency={clinical.clinical_urgency}",
        f"confidence={clinical.confidence}",
        f"placement_action={placement_action}",
        f"comparisons={comparison_count}",
    ]
    if anchor_case_id:
        pieces.append(f"anchor_case_id={anchor_case_id}")
    if clinical.red_flags:
        pieces.append("red_flags=" + ",".join(clinical.red_flags[:4]))
    if clinical.missing_information:
        pieces.append("missing=" + ",".join(clinical.missing_information[:4]))
    if pairwise_failure:
        pieces.append(f"pairwise_failure={pairwise_failure}")
    if needs_review:
        pieces.append("route=ct_escalation_agent")
    return "; ".join(pieces)


def _string_or_none(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    return int(value)
