# Build state (updated 2026-07-17 ~14:05 PT, day 1)

Authoritative spec: `specs/standing-questions-spec.md`. Judged criteria and
recon: `../CLICKHOUSE-TRIGGERDEV-PREP-20260716.md`. Deadline: 2026-07-23
Midnight AoE; freeze target 2026-07-21; submit target 2026-07-22.
Submission is a Google Form (link in prep file), NOT Devpost.

## Done (all verified, repo clean at ea848af on origin/main)
- Repo public, 11 in-window commits; sponsor skills packs installed (17,
  project-scoped; vitest+eslint scoped to exclude them).
- Spec S1-S5; scaffold (Next.js 16 + Trigger init ref proj_zzzpureafpslkdubhxkc).
- Seams GREEN, 27/27 tests + typecheck + lint: diffSnapshots (8), compileQuestion
  (11, incl. literal-stripping gate fix), evaluatePlan (4, live local CH),
  renderVerdict (4).
- S1 LIVE ALLOW PROOF green: real claude-sonnet-5 -> gated SQL -> live CH ->
  verdict. Artifact: docs/proofs/allow-proof.json. Run:
  `doppler run --project standing-questions --config dev -- env CH_TEST_URL=http://localhost:8123 npx vitest run --config vitest.proof.config.ts`
- /api/ask route written (route.ts) - typechecked, NOT yet exercised over HTTP.
- Claude 5 contract: NO temperature/top_p/top_k (400); propose.ts uses
  thinking disabled + effort low. Spec updated to match.

## Local runtime (re-establish after reboot)
- clickhousectl server `standing-questions` on http 8123 / tcp 9000, tables
  bluesky_events (48 seeded test rows) + sq_ticks. Restart:
  `export PATH="$HOME/.local/bin:$PATH" && clickhousectl local server start --name standing-questions`
  then apply `clickhouse/tables/*.sql` if tables missing.
- doppler `standing-questions` dev+prd: ALL secrets live and proven
  (CLICKHOUSE_* cloud, TRIGGER_*, ANTHROPIC_API_KEY, DATABASE_URL=Neon
  snowy-cake-59107910 us-west-2).

## Next (in order)
1. UI slice: chat page + LivingAnswerCard (SVG chart, verdict line, evidence
   drawer) wired to POST /api/ask. MUST read node_modules/next/dist/docs
   conventions FIRST (repo AGENTS.md: Next 16 diverges from training).
   Server-rendered ?demo= mode per skill Phase 4 (video needs SSR'd result).
2. S5 browser acceptance (Playwright, desktop+mobile) - judge 60s path.
3. Slice 2: Bluesky Jetstream ingest task (Trigger.dev; use trigger-tasks
   skill) -> Cloud CH; standing re-eval cron + Delta Card via Realtime
   (trigger-realtime skill); sq_ticks telemetry.
4. Slice 3: Neon OLTP (subscriptions/threads/told-ledger) + ClickPipes CDC
   (enable logical replication toggle in Neon console when this lands) -
   bonus category.
5. Register repo in estate_home_registry.yaml (own PR); Vercel deploy (pin
   fns pdx1, alias identity check, rate limit + burst 429 test); video <=5min
   visual-first; adversarial review x2 engines; package Google Form; freeze
   2026-07-21.

## Operator-held
- Redeem Trigger promo: cloud.trigger.dev/promo?code=clickhack2026 ($100).
- Acceptance email: raffle social-post requirement check.
