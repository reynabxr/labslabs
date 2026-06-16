# CT Band Multi-Agent Proof

This workflow uses SQLite as the queue and case-state store while Band remains the coordination layer.

One Band room represents one CT case. The agents do not call each other directly. Each step posts a structured JSON message back into the same room and updates the SQLite record.

## Agents

- `ct_dispatcher_agent`: opens the next pending case in a fresh Band room.
- `ct_router_agent`: plain Python agent that loads and normalizes the case, preserves `case_id` and `patient_code`, computes provisional urgency metadata, marks pending cases `routed`, and sends structured `case` JSON to the review agent.
- `ct_review_agent`: LangGraph agent that reviews the incoming case against the current SQLite queue snapshot and emits structured queue placement guidance.
- `ct_escalation_agent`: receives review messages that need human review, marks the case `escalated`, and publishes a human handoff packet with explicit choices.

No moderator agent is used in this workflow.

## Review Logic

`ct_review_agent` receives the structured `message_type: "case"` JSON from the router. It does not chat with the user and does not invent missing data.

The review graph is:

```text
ingest_case
load_queue_snapshot
assess_clinical_risk
assess_queue_position
decide_recommendation
emit_structured_result
```

The agent loads the current pending queue from SQLite through the existing queue engine, compares the incoming case against nearby cases, and returns a recommendation.

For a brand-new case, the review result does not use `rank_change` as the primary recommendation. The review result instead reports:

- `proposed_rank`
- `queue_action`
- `affected_case_ids`
- `recommended_next_route`

The queue engine remains responsible for actual queue recomputation and rank-change persistence after the review step.

Example review output:

```json
{
  "message_type": "review",
  "case_id": "13960219003",
  "patient_code": "9608665.0",
  "clinical_risk": "HIGH",
  "confidence": 0.82,
  "queue_assessment": "UNDER_RANKED",
  "proposed_rank": 1,
  "queue_action": "insert",
  "affected_case_ids": ["13960219005", "13960219002"],
  "needs_human_review": false,
  "summary": "Case 13960219003 is recommended for insertion at rank 1 after comparison with nearby cases.",
  "recommended_next_route": "final_result",
  "review_reasoning_summary": "risk=HIGH; urgency_score=8; signals=low_spo2"
}
```

Cases that need human review are sent to `ct_escalation_agent`. The handoff packet marks the case as escalated and records the due time. Human intervention is applied out of band:

```bash
python3 scripts/human_decision.py 13960219003 approve
python3 scripts/human_decision.py 13960219003 return_to_review --notes "Needs another look"
```

Overdue human reviews can be expired manually:

```bash
python3 scripts/expire_human_reviews.py
```

## SQLite Workflow

Database schema:

```sql
CREATE TABLE cases (
    case_id TEXT PRIMARY KEY,
    patient_code TEXT,
    status TEXT,
    payload TEXT,
    final_result TEXT,
    created_at TEXT,
    updated_at TEXT,
    priority_score REAL,
    queue_rank INTEGER,
    previous_rank INTEGER,
    rank_change INTEGER,
    queue_version INTEGER,
    manual_priority_override REAL,
    human_packet TEXT,
    human_status TEXT,
    human_due_at TEXT,
    human_decision TEXT,
    human_decision_notes TEXT,
    human_decided_at TEXT
);
```

The database also includes a `queue_events` audit table for queue recomputation events.

Status values:

```text
pending
routed
reviewed
escalated
completed
```

## Environment

Required:

```bash
THENVOI_WS_URL=...
THENVOI_REST_URL=...
```

Optional:

```bash
CASES_DB_PATH=/absolute/path/to/cases.db
CT_REVIEW_CONFIDENCE_THRESHOLD=0.65
CT_HUMAN_REVIEW_TIMEOUT_MINUTES=15
```

Band credentials must be available through the Band SDK config loader for these names:

```text
ct_dispatcher_agent
ct_router_agent
ct_review_agent
ct_escalation_agent
```

Optional mention overrides:

```bash
CT_ROUTER_MENTION=@ct_router_agent
CT_REVIEW_MENTION=@ct_review_agent
CT_ESCALATION_MENTION=@ct_escalation_agent
```

## Setup

Create the database and seed the sample cases:

```bash
python3 scripts/create_db.py
python3 -m storage.seed_cases
```

## Run

Start each process in a separate terminal:

```bash
python3 -m agents.run_router
python3 -m agents.run_review
python3 -m agents.run_escalation
```

Process one queued case:

```bash
python3 scripts/process_next_case.py
```

Or enqueue a mock case and immediately hand the current top pending case into Band:

```bash
python3 scripts/mock_queue_flow.py enqueue --row-number 2 --dispatch-next
```

Replay helpers:

```bash
python3 scripts/reset_case.py 13960219002
python3 scripts/seed_one_case.py --case-id 13960219002
python3 scripts/seed_one_case.py --row-number 2
python3 scripts/seed_one_case.py --case-id 13960219002 --force-escalation
```

This proof creates a fresh Band room for each queued case it starts. The SQLite `case_id` is carried in the Band message payload, not in the Band `task_id` field. The dispatch script posts the `queue_trigger` automatically from the SQLite queue using a dedicated `ct_dispatcher_agent`, then the three workflow agents handle the rest.

`CT_REVIEW_CONFIDENCE_THRESHOLD` controls when `ct_review_agent` asks for human review. Lower values keep more valid-but-partial cases on the automatic path.
`CT_HUMAN_REVIEW_TIMEOUT_MINUTES` sets the due time for a human decision. Overdue escalations are expired by `scripts/expire_human_reviews.py` and also when the dispatch bridge runs.
Human decisions are recorded by `scripts/human_decision.py`, so no human UUID is required.

## Test

Expected flow for the first seeded case:

1. Router posts a `case` JSON message mentioning `@ct_review_agent`.
2. Review loads the current queue snapshot, compares the incoming case with nearby pending cases, and emits a structured `review` JSON result.
3. If the review needs human review, Review posts the `review` JSON message mentioning `@ct_escalation_agent`.
4. Escalation posts a `human_handoff` JSON packet with explicit actions and leaves the case in `escalated`.
5. A human operator runs `scripts/human_decision.py` to approve the case or return it to review.
6. SQLite stores the final JSON in `final_result` and sets `status = completed` when the case completes.

The remaining seeded cases stay `pending` until `process_next_case.py` is run again.

To simulate arrivals and departures in real time, use:

```bash
python3 scripts/mock_queue_flow.py simulate --arrival-row-numbers 2,3,4 --arrival-gap-seconds 10 --top-leave-after-seconds 30
```

To expire overdue human reviews manually, use:

```bash
python3 scripts/expire_human_reviews.py
```

## Local Checks

Compile the changed workflow:

```bash
.venv/bin/python3 -m py_compile agents/review_agent.py agents/shared_schema.py agents/review_adapter.py agents/run_review.py agents/escalation_agent.py agents/escalation_adapter.py agents/run_escalation.py scripts/expire_human_reviews.py scripts/mock_queue_flow.py src/labslabs/band_dispatch.py storage/queue_store.py storage/db.py
```
