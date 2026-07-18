# Standing Questions

Ask the Bluesky firehose a question once. Get a living chart instead of a paragraph. Pin it, and an agent keeps re-evaluating on a schedule; when the picture materially changes, the agent reopens the thread with a visual delta, not a wall of text.

Built for the ClickHouse and Trigger.dev Virtual Summer Hackathon 2026 (theme: "Beyond the Wall of Text").

## How it works

```
question --> compileQuestion (claude-sonnet-5, fail-closed JSON plan)
                |  SQL gate: single SELECT, allowlisted tables, LIMIT required,
                |  keyword blocklist with string-literal stripping
                v
          evaluatePlan --> ClickHouse Cloud (bluesky_events, live firehose data)
                |
                v
          Living Answer card: in-house SVG chart + one-line verdict + evidence drawer
                |  Pin it
                v
          standing_questions + told_ledger (Neon Postgres, OLTP)
                |
   Trigger.dev scheduled tasks (prod, verified live):
     ingest-firehose  */5   bounded 25s Jetstream capture -> batch insert
     reeval-standing  */10  evaluatePlan -> diffSnapshots vs told-baseline
                |  deterministic delta rule fires (threshold, the demonstrated kind,
                |  or regime once a full trailing window exists; never model vibes)
                v
          Told-Ledger row + Delta Card in the thread feed
          (Trigger.dev Realtime pushes the refresh; 30s fallback without a token)
```

- The baseline only moves when the agent tells you something, so slow drifts accumulate until the rule fires instead of being silently absorbed.
- Every evaluation writes self-telemetry to `sq_ticks` in ClickHouse (outcome silent/delta/error, eval latency).
- The model never touches the database directly: it emits a JSON plan; a deterministic gate validates the SQL before anything executes. Refusals, malformed plans, gated SQL, timeouts, query errors, and unreachable data all render as typed error cards.

## Stack

- **ClickHouse Cloud**: OLAP home of the firehose (`bluesky_events`) and agent telemetry (`sq_ticks`); local clickhousectl server for dev/tests.
- **Trigger.dev v4**: scheduled ingest + re-evaluation tasks (runtime `node-22`), run tags + Realtime for live UI refresh.
- **Neon Postgres**: OLTP plane; standing questions and the Told-Ledger. The `sq_cdc` publication feeds a running ClickPipe (`sq-neon-cdc`) that CDCs `standing_questions` and `told_ledger` into ClickHouse; the OLTP-plus-OLAP join is live on the public standing-watch section (bonus category, shipped).
- **Next.js 16 + Anthropic API**: chat page, SSR `?demo=` mode, `/api/ask` and `/api/pin` with per-IP rate limits.

## Run it

```bash
npm install
# secrets via doppler (ANTHROPIC_API_KEY, CLICKHOUSE_*, DATABASE_URL, TRIGGER_SECRET_KEY)
npm run dev                      # app
npx vitest run                   # 47 unit tests (seams: compile gate, diff, geometry, ingest mapping, rate limit, OLAP join)
npx vitest run --config vitest.proof.config.ts   # live proofs (real model, real ClickHouse, real Jetstream)
npx trigger.dev@4.5.4 dev        # run the tasks locally
```

## Honest limits

- The public demo is keyless and read-only; per-IP rate limits are per serverless instance, not global.
- The demo exercises the threshold delta path; a regime rule pinned before it has a full trailing window of hourly buckets cannot fire until that history accumulates.
- One week of build window; the delta rules are two deterministic kinds (threshold, regime), not a rules engine.

All code written during the hackathon window. AI assistants were used, as permitted by the rules.
