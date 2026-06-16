from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from .shared_schema import HumanHandoffMessage, ReviewMessage


def create_human_handoff(review: ReviewMessage) -> HumanHandoffMessage:
    due_at = _human_due_at()
    return HumanHandoffMessage(
        case_id=review.case_id,
        patient_code=review.patient_code,
        clinical_risk=review.clinical_risk,
        confidence=review.confidence,
        proposed_rank=review.proposed_rank,
        queue_action=review.queue_action,
        queue_assessment=review.queue_assessment,
        reason=review.review_reasoning_summary or review.clinical_risk,
        summary=review.summary,
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
