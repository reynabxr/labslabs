from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, Field

from .router_schema import CaseMessage


class ReviewMessage(BaseModel):
    message_type: str = Field(default="review")
    case_id: str
    patient_code: str
    clinical_risk: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    confidence: float
    queue_assessment: Literal[
        "APPROPRIATE",
        "UNDER_RANKED",
        "OVER_RANKED",
        "NEEDS_HUMAN_REVIEW",
    ]
    proposed_rank: int | None = None
    queue_action: Literal["insert", "move_up", "stay_put", "escalate"]
    affected_case_ids: list[str] = Field(default_factory=list)
    needs_human_review: bool
    summary: str
    recommended_next_route: Literal["final_result", "human_review"]
    review_reasoning_summary: str | None = None


class HumanHandoffMessage(BaseModel):
    message_type: str = Field(default="human_handoff")
    case_id: str
    patient_code: str
    clinical_risk: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    confidence: float
    proposed_rank: int | None = None
    queue_action: str
    queue_assessment: str
    reason: str
    summary: str
    due_at: str | None = None
    available_actions: list[Literal["approve", "return_to_review"]] = Field(
        default_factory=lambda: ["approve", "return_to_review"]
    )
    decision_prompt: str = Field(
        default="Use scripts/human_decision.py to approve or return the case before due_at."
    )


def model_to_json(model: BaseModel) -> str:
    return model.model_dump_json(indent=2)


def parse_json_object(text: str) -> dict[str, Any]:
    """Extract the first JSON object from a Band message body."""
    cleaned = text.strip()
    if "```" in cleaned:
        chunks = cleaned.split("```")
        for chunk in chunks:
            candidate = chunk.strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].strip()
            if candidate.startswith("{") and candidate.endswith("}"):
                return json.loads(candidate)

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in message")
    return json.loads(cleaned[start : end + 1])
