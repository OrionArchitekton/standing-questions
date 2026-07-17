# Standing Questions - living behavior spec

For people who watch live data and must decide when to look and when to act.
Standing Questions is a chat agent where the answer is a living visual artifact:
ask once, get a rendered chart with a one-line verdict, pin it, and the agent
watches it against the live stream and opens the conversation with a visual
delta when reality changes. Text is the garnish, not the meal.

Event frame: ClickHouse & Trigger.dev Virtual Summer Hackathon 2026, theme
"Beyond the Wall of Text". Judged lens: ratio of insight to words.

## Domain language (canonical terms)

- **Question**: a natural-language ask over the firehose data.
- **Living Answer**: the response artifact - an interactive rendered chart plus
  a verdict of at most one line. Never a paragraph.
- **Standing Question**: a pinned Living Answer the agent re-evaluates on a
  schedule. Owned by a thread.
- **Delta Card**: an agent-initiated message rendering what changed - a
  before/after visual with a note of at most twenty words.
- **Firehose**: the continuously ingested public event stream stored in
  ClickHouse (primary: Bluesky Jetstream; connector is swappable).
- **Told-Ledger**: the record of what the agent last showed each thread; the
  baseline every Delta is computed against.

## Scenarios (tracer-bullet vertical slices, dependency order)

### S1 - Ask, receive a Living Answer
A visitor types a Question about the firehose. The agent compiles it into a
typed ChartPlan: a read-only ClickHouse query over the allowed schema, a chart
specification, and a verdict rule. Deterministic code validates the plan
(allowlisted tables, read-only shape, bounded time range and result size),
executes it, and the thread renders a Living Answer.
- Accept: the demo Question returns an interactive chart and one-line verdict
  with zero body paragraphs; the full path exercises the real model and real
  ClickHouse at least once end-to-end (recorded as the ALLOW proof).
- Accept: a refusal, malformed plan, disallowed table, or timeout fails closed
  to an honest error card that names what could not be verified. No silent
  fallback to text.

### S2 - Pin it: the Question starts standing
The visitor pins a Living Answer. The Standing Question, its thread, and its
Told-Ledger baseline persist in Postgres (OLTP). A Trigger.dev scheduled task
re-evaluates the ChartPlan against live ClickHouse; an unchanged result is a
silent tick recorded to self-telemetry in ClickHouse.
- Accept: pin -> row exists, schedule fires, silent tick leaves the thread
  untouched and the telemetry row exists.

### S3 - The agent opens the conversation
When re-evaluation crosses the Standing Question's delta rule (a deterministic
threshold or regime change - never model vibes), the agent authors a Delta
Card and pushes it into the open thread over Trigger.dev Realtime. The visitor
can drill down: the card exposes its query, window, and evidence.
- Accept: a seeded material change produces exactly one Delta Card whose
  before/after visuals match the Told-Ledger baseline and live data; the
  Told-Ledger advances; a sub-threshold change produces nothing.

### S4 - OLTP + OLAP, load-bearing (bonus category)
Standing Questions, threads, and Told-Ledger live in Postgres; ClickPipes CDC
replicates them into ClickHouse, where "what changed since I last showed you"
is computed by joining the Told-Ledger against live aggregates - the join is
only possible because both planes meet in ClickHouse.
- Accept: a Told-Ledger write in Postgres is queryable in ClickHouse within
  CDC lag; the delta computation reads the replicated table, not the app DB.

### S5 - Judge path (sixty seconds)
Open the public demo: a seeded Standing Question is already live and visibly
updating. Ask a new Question, receive a Living Answer, pin it. No login, no
key, no upload.
- Accept: the three steps complete on the public URL in under a minute;
  Chromium acceptance covers the flow at desktop and mobile viewports.

## Constraints

- Visual-first is enforced, not hoped: agent surfaces render charts/cards;
  verdicts are one line; notes are twenty words; there is no long-form text
  path to fall back to.
- The model (claude-sonnet-5, temperature 0) proposes typed plans only;
  deterministic code owns validation, execution, delta decisions, and every
  terminal state. Model output never reaches the page unvalidated; the style
  ban (no long dashes) lives in the prompt AND is verified on capture.
- Public demo is keyless; the model key stays server-side, spend-capped, and
  rate-limited (burst-verified 429s before submission).
- All code written inside the build window (2026-07-17 09:00 CET to
  2026-07-23 AoE). Sponsor stack is load-bearing on both sides by design.

## Seams (test boundaries - fewest, highest)

1. `compileQuestion(question, schema) -> ChartPlan` - the model boundary.
   Typed, fail-closed, unit-tested against recorded fixtures; the live call is
   exercised once by the ALLOW proof, not by every test.
2. `evaluatePlan(plan, clickhouse) -> Snapshot` - deterministic data seam;
   integration-tested against local ClickHouse in docker, same SQL in Cloud.
3. `diffSnapshots(baseline, next, rule) -> Delta | null` - pure function;
   property-style unit tests carry the delta semantics.
4. Browser acceptance drives S5 end-to-end; it is the only place the full
   stack is exercised together.

## Non-goals (v1)

Arbitrary user SQL, uploads or user-supplied connectors, auth/multi-tenancy
(single shared demo space), historical backfill beyond the event window, any
text-report mode, and post-event OSS packaging (separate decision).
