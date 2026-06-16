from __future__ import annotations

import logging

from band.core import AgentToolsProtocol, HistoryProvider, PlatformMessage, SimpleAdapter

from .band_utils import participant_mention, sender_mention
from .review_agent import review_case
from .shared_schema import CaseMessage, model_to_json, parse_json_object
from storage.queue_store import mark_completed, mark_reviewed

logger = logging.getLogger(__name__)


class CTReviewAdapter(SimpleAdapter[HistoryProvider]):
    def __init__(
        self,
        *,
        review_mention: str = "@ct_review_agent",
        escalation_mention: str = "@ct_escalation_agent",
    ) -> None:
        super().__init__()
        self.review_mention = review_mention
        self.escalation_mention = escalation_mention

    async def on_message(
        self,
        msg: PlatformMessage,
        tools: AgentToolsProtocol,
        history: HistoryProvider,
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        try:
            payload = parse_json_object(msg.content)
            if payload.get("message_type") != "case":
                if _is_intended_for(msg.content, self.review_mention):
                    raise ValueError("Expected message_type='case'")
                return
            case = CaseMessage.model_validate(payload)
        except Exception as exc:
            if not _is_intended_for(msg.content, self.review_mention):
                return
            logger.exception("Failed to parse case message")
            mention = sender_mention(tools, msg, fallback=self.review_mention)
            await tools.send_message(
                content=f"{self.review_mention} could not parse case JSON: {exc}",
                mentions=[mention],
            )
            return

        review = review_case(case)
        mark_reviewed(case.case_id)
        logger.info(
            "CASE_REVIEWED case_id=%s clinical_risk=%s proposed_rank=%s queue_action=%s affected_case_count=%s needs_human_review=%s",
            case.case_id,
            review.clinical_risk,
            review.proposed_rank,
            review.queue_action,
            len(review.affected_case_ids),
            review.needs_human_review,
        )
        if review.needs_human_review:
            escalation_mention = participant_mention(
                tools,
                self.escalation_mention,
                "ct_escalation_agent",
                "ct-escalation-agent",
                "CT Escalation Agent",
            )
            content = (
                f"{escalation_mention}\n```json\n{model_to_json(review)}\n```"
            )
            await tools.send_message(content=content, mentions=[escalation_mention])
            return

        review_json = model_to_json(review)
        content = f"Final Result\n```json\n{review_json}\n```"
        await tools.send_message(content=content)
        mark_completed(case.case_id, review_json)


def _is_intended_for(content: str, mention: str) -> bool:
    return mention.lower() in content.lower()
