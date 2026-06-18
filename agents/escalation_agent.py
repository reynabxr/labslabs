from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from .moderator_schema import ModeratorDecisionMessage
from .shared_schema import HumanHandoffMessage, ReviewMessage


def create_human_handoff(
    review: ReviewMessage | ModeratorDecisionMessage,
) -> HumanHandoffMessage:
    due_at = _human_due_at()
    clinical_risk = (
        review.clinical_risk
        if isinstance(review, ReviewMessage)
        else review.clinical_urgency
    )
    reason = (
        review.review_reasoning_summary
        if isinstance(review, ReviewMessage)
        else review.reason_summary
    )
    summary = review.summary if isinstance(review, ReviewMessage) else review.reason_summary
    return HumanHandoffMessage(
        case_id=review.case_id,
        patient_code=review.patient_code,
        clinical_risk=clinical_risk,
        confidence=review.confidence,
        proposed_rank=None if isinstance(review, ModeratorDecisionMessage) else review.proposed_rank,
        queue_action=review.placement_action if isinstance(review, ModeratorDecisionMessage) else review.queue_action,
        queue_assessment="NEEDS_HUMAN_REVIEW" if isinstance(review, ModeratorDecisionMessage) else review.queue_assessment,
        reason=reason or clinical_risk,
        summary=summary,
        due_at=due_at,
    )


def _human_due_at() -> str | None:
    raw_timeout = os.getenv("CT_HUMAN_REVIEW_TIMEOUT_MINUTES")
    if raw_timeout is None or not raw_timeout.strip():
        timeout_minutes = 15
    else:
        try:
            timeout_minutes = max(1, int(raw_timeout))
        except ValueError:
            timeout_minutes = 15
    if timeout_minutes <= 0:
        return None
    return (datetime.now(timezone.utc) + timedelta(minutes=timeout_minutes)).isoformat()
