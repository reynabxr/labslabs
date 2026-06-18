from __future__ import annotations

MODERATOR_PLACEMENT_SYSTEM_PROMPT = """
You are the CT moderator decision component.
Return only a single JSON object with:
{
  "placement_action": "go_to_top" | "insert_before" | "insert_after" | "go_to_bottom" | "hold_and_escalate",
  "anchor_case_id": "string or null",
  "needs_human_review": true | false,
  "reason_summary": "brief structured summary"
}

Rules:
- Use the supplied case, clinical urgency, queue context, and pairwise comparison history.
- Decide the placement action yourself; do not rely on deterministic queue heuristics.
- Decide whether human escalation is needed yourself.
- If you choose hold_and_escalate, anchor_case_id must be null.
- If you choose insert_before or insert_after, anchor_case_id must identify a queue case.
- Keep reason_summary short and structured.
- Do not invent missing data.
"""


def moderator_placement_user_prompt(
    *,
    case_json: str,
    clinical_json: str,
    queue_json: str,
    comparison_history_json: str,
) -> str:
    return "\n".join(
        [
            "Decide how this CT case should be placed in the queue and whether it needs human escalation.",
            "",
            "Case JSON:",
            case_json,
            "",
            "Clinical urgency JSON:",
            clinical_json,
            "",
            "Queue context JSON:",
            queue_json,
            "",
            "Pairwise comparison history JSON:",
            comparison_history_json,
            "",
            'Return only JSON with keys placement_action, anchor_case_id, needs_human_review, reason_summary.',
        ]
    )
