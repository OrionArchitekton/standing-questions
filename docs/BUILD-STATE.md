# Build state (updated 2026-07-17 ~15:45 PT, day 1)

SLICE 3 / S4 BONUS LIVE (all four scenarios' infrastructure now proven):
- Neon logical replication ON (operator, ~15:30); clickpipes_user
  (REPLICATION + SELECT-only) with password in doppler
  NEON_CLICKPIPES_PASSWORD; ClickPipe sq-neon-cdc
  (e94ffca2-4fc3-4113-b661-d8df42a63280) created via Cloud API, Running.
- standing_questions + told_ledger CDC'd into Cloud CH default db
  (SharedReplacingMergeTree, _peerdb_version / _peerdb_is_deleted).
- S4 join live on the PUBLIC page: StandingWatch section, told-ledger vs
  hourly firehose rollup, greatest() for join_use_nulls=0 zero-DateTime
  misses. 47/47 tests; deployed READY.
- ClickPipes API contract recon persisted: OpenAPI spec copy at scratchpad
  ch-openapi.json (session-scoped); key facts: POST .../clickpipes, basic
  auth key-id:secret, source.postgres type "neon", settings.publicationName
  reuses existing pub, destination {database} only for db pipes.

PUBLIC URL (verified live): https://standing-questions.vercel.app
- /api/ask 200 with real cron-ingested Cloud data (2,295 posts in the
  current hour bucket); ?demo= SSR carries the card; burst test = 10x 400
  then 429s (per-IP limiter); /api/realtime-token 503 -> 30s fallback
  (dev-scoped TRIGGER_SECRET_KEY deliberately NOT seeded on Vercel: a
  dev-env Realtime subscription would watch the empty dev env and never
  refresh; seed the PROD key then `vercel env add` + redeploy).
- Vercel project standing-questions (scope dan-mercedes-projects), GitHub
  repo auto-connected, functions pinned pdx1.

Authoritative spec: `specs/standing-questions-spec.md`. Judged criteria and
recon: `../CLICKHOUSE-TRIGGERDEV-PREP-20260716.md`. Deadline: 2026-07-23
Midnight AoE; freeze target 2026-07-21; submit target 2026-07-22.
Submission is a Google Form (link in prep file), NOT Devpost.

## Done (all verified)
- Repo public, 13+ in-window commits; sponsor skills packs installed (17,
  project-scoped; vitest+eslint scoped to exclude them).
- Spec S1-S5; scaffold (Next.js 16 + Trigger init ref proj_zzzpureafpslkdubhxkc).
- Seams GREEN, 36/36 tests + typecheck + lint + build: diffSnapshots (8),
  compileQuestion (11, incl. literal-stripping gate fix), evaluatePlan (4,
  live local CH), renderVerdict (4), chartGeometry (9).
- S1 LIVE ALLOW PROOF green: real claude-sonnet-5 -> gated SQL -> live CH ->
  verdict. Artifact: docs/proofs/allow-proof.json. Run:
  `doppler run --project standing-questions --config dev -- env CH_TEST_URL=http://localhost:8123 npx vitest run --config vitest.proof.config.ts`
- UI slice SHIPPED and live-verified: chat page + LivingAnswerCard (in-house
  SVG chart line/bar/area, verdict line, evidence drawer with gated SQL +
  watch rule), ErrorCard (typed failure reasons), AskForm (client). POST
  /api/ask exercised over HTTP (200, full card). `?demo=` SSR mode proven:
  plain curl HTML carries card + verdict + SVG (video-capture guarantee).
- Browser judge-path verified via Playwright MCP, desktop 1280px + mobile
  390px: chip click -> loading -> living answer card (bar chart with data);
  evidence drawer opens; SSR demo page renders card without JS.
- Claude 5 contract: NO temperature/top_p/top_k (400); propose.ts uses
  thinking disabled + effort low. Spec updated to match.
- firehose-schema description fixed: ts described as UTC DateTime (was "UTC
  seconds", which made the model emit toUnixTimestamp/toDateTime warts).
- SLICE 2 (41/41 tests): ingest-firehose task (5-min cron, bounded 25s
  Jetstream capture -> Cloud CH batch insert) LIVE-PROVEN manually (2,726
  rows / 8s window, count verified). Neon standing_questions + told_ledger
  applied; /api/pin + PinButton (browser-verified, Neon row confirmed);
  reeval-standing-questions task (10-min cron): evaluatePlan -> diffSnapshots
  vs told-baseline -> told_ledger + sq_ticks, LIVE-PROVEN (threshold fired on
  real data; sq_ticks 1 row/1 delta in Cloud). ToldFeed on page. Realtime:
  runs self-tag 'sq', /api/realtime-token (read-only public token),
  LiveRefresh hook with 30s-refresh fallback.
- Trigger prod VERIFIED LIVE (v20260717.4, node-22, 2 tasks): ingest cron
  fired autonomously at 22:15 UTC - Cloud CH 2,726 -> 11,083 rows in one 25s
  capture; reeval cron completed with a silent tick (343ms, sq_ticks row) on
  the pinned question - S2 acceptance proven by the deployed cron itself.
  Root-caused en route: default "node" runtime lacks global WebSocket
  ("WebSocket is not defined", 3 failed runs) -> runtime "node-22"; one
  transient apt exit-100 image-build failure, clean on retry.
- Prod visibility WITHOUT dashboard: `npx trigger.dev@4.5.4 mcp` spoken over
  stdio JSON-RPC (tools: list_runs, get_run_details) authenticates via the
  CLI login and sees prod runs/schedules. doppler TRIGGER_SECRET_KEY is
  DEV-scoped: Realtime token minting on the deployed app needs a PROD secret
  key seeded (operator); UI falls back to 30s refresh until then.

## Local runtime (re-establish after reboot)
- clickhousectl server `standing-questions` on http 8123 / tcp 9000. Restart:
  `export PATH="$HOME/.local/bin:$PATH" && clickhousectl local server start --name standing-questions`
  then apply `clickhouse/tables/*.sql` if tables missing.
- **Seed/data ops via HTTP 8123 curl ONLY** (the surface the app uses):
  `tail -n +5 clickhouse/seed/bluesky_events.sql | curl -s "http://localhost:8123/" --data-binary @-`
  (TRUNCATE first; see seed file header). GOTCHA: `clickhousectl local client`
  invocations do NOT reliably hit the 8123 server (writes landed in a separate
  backend; UTC vs PT rendering differs) - do not use it for inserts/verifies.
- Seed is now()-relative (400 rows, last ~47h) so "today" questions have data.
  Re-apply before demo/video capture.
- Local prod run: `npm run build` then
  `doppler run --project standing-questions --config dev -- env CLICKHOUSE_URL=http://localhost:8123 CLICKHOUSE_USER=default CLICKHOUSE_PASSWORD= PORT=3300 npm run start`
- doppler `standing-questions` dev+prd: ALL secrets live and proven
  (CLICKHOUSE_* cloud, TRIGGER_*, ANTHROPIC_API_KEY, DATABASE_URL=Neon
  snowy-cake-59107910 us-west-2).

## Next (in order)
1. Optional S5 hardening: committed Playwright spec (desktop+mobile 60s judge
   path) - interactive path already verified live via MCP browser.
2. Slice 2: Bluesky Jetstream ingest task (Trigger.dev; use trigger-tasks
   skill) -> Cloud CH; standing re-eval cron + Delta Card via Realtime
   (trigger-realtime skill); sq_ticks telemetry.
3. Slice 3: Neon OLTP (subscriptions/threads/told-ledger) + ClickPipes CDC
   (enable logical replication toggle in Neon console when this lands) -
   bonus category.
4. Register repo in estate_home_registry.yaml (own PR); Vercel deploy (pin
   fns pdx1, alias identity check, rate limit + burst 429 test); video <=5min
   visual-first; adversarial review x2 engines; package Google Form; freeze
   2026-07-21.

## Operator-held
- Redeem Trigger promo: cloud.trigger.dev/promo?code=clickhack2026 ($100).
- Acceptance email: raffle social-post requirement check.
