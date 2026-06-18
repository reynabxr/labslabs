# Band CT Triage

This repo is a queue-driven CT triage proof.

Band is used for agent coordination. SQLite stores the queue, case state, and human-review state. The human decision path does not rely on a human UUID in Band.

## What Runs

- `ct_dispatcher_agent` opens a Band room for the next queued case.
- `ct_router_agent` normalizes the case and posts structured `case` JSON.
- `ct_review_agent` uses LangGraph and optional LLM refinement to emit single-case clinical urgency signals.
- `ct_moderator_agent` uses LangGraph and optional LLM placement reasoning to evaluate queue placement against the current queue context.
- `ct_escalation_agent` handles cases that need human review and posts a handoff packet.

## Human Review

Human approval is applied out of band with:

```bash
python3 scripts/human_decision.py <case_id> approve
python3 scripts/human_decision.py <case_id> return_to_review --notes "Needs another look"
```

Overdue escalations can be expired manually with:

```bash
python3 scripts/expire_human_reviews.py
```

## Queue Flow

The CT queue is simulation-based. The dataset does not need CT order arrival or
completion timestamps. Queue state is driven by a persistent simulation clock:
`current_tick` advances when a case enters, a placement/reorder is applied, or
the top case completes. Active queue snapshots expose `queue_position`,
`previous_position`, `rank_change`, `queue_version`, `arrival_seq`,
`enqueue_tick`, `start_tick`, `completion_tick`, and `waiting_ticks`.

Only the case at queue position 1 may complete. Completion removes that case
from the active queue, shifts the remaining cases upward, increments
`queue_version`, and logs queue events with `simulation_tick` and
`affected_case_ids`.

The queue engine applies moderator placement decisions deterministically. The
review LLM decides clinical urgency and the moderator LLM decides placement and
escalation; the queue engine only rewrites the stored queue state to match that
decision.

Process the next queued case:

```bash
python3 scripts/process_next_case.py
```

Run the simulated queue with timed arrivals and departures:

```bash
python3 scripts/mock_queue_flow.py simulate --arrival-row-numbers 2,3,4 --arrival-gap-seconds 10 --top-leave-after-seconds 30
```

Run a one-off enqueue and dispatch:

```bash
python3 scripts/mock_queue_flow.py enqueue --row-number 2 --dispatch-next
```

## Setup

Create the database and seed the sample cases:

```bash
python3 scripts/create_db.py
python3 -m storage.seed_cases
```

Start the Band-backed agents:

```bash
python3 -m agents.run_router
python3 -m agents.run_review
python3 -m agents.run_moderator
python3 -m agents.run_escalation
```

See [agents/README.md](agents/README.md) for the full workflow, message contracts, environment variables, and test flow.
