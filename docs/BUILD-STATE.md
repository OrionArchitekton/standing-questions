# Build state (updated 2026-07-17 ~10:20 PT, day 1)

Authoritative spec: `specs/standing-questions-spec.md`. Judged criteria and
recon: `../CLICKHOUSE-TRIGGERDEV-PREP-20260716.md`. Deadline: 2026-07-23
Midnight AoE; freeze target 2026-07-21; submit target 2026-07-22.

## Done
- Repo public, 8 in-window commits; sponsor skills packs installed (17).
- Spec S1-S5 committed; scaffold (Next.js + Trigger init with true ref
  proj_zzzpureafpslkdubhxkc + deps + verify bar).
- Seam 3 GREEN: `diffSnapshots` (src/core/diff.ts), 8 tests, lint/typecheck
  clean. eslint scoped to exclude vendor packs.
- Infra proven live: ClickHouse Cloud (SELECT 1), Neon (SELECT 1), doppler
  `standing-questions` dev+prd fully seeded (9 secrets), Anthropic key valid.

## Next (in order)
1. Seam 1: `compileQuestion(question, schema) -> ChartPlan` - zod schema,
   fail-closed parse, recorded fixtures (tests/), claude-sonnet-5 temp 0.
2. Seam 2: `evaluatePlan(plan, ch) -> Snapshot` vs local docker ClickHouse.
3. Firehose ingest task (Bluesky Jetstream -> CH) as a Trigger.dev task.
4. Chat UI + Living Answer chart card (read node_modules/next/dist/docs
   FIRST per repo AGENTS.md - Next.js conventions diverge from training).
5. Live ALLOW proof vs Cloud; then Slice 2 (standing re-eval + Delta Card
   via Realtime), Slice 3 (Neon OLTP + ClickPipes CDC; enable logical
   replication toggle in Neon console when this lands).
6. Register repo in estate_home_registry.yaml (own PR); Vercel deploy
   (pin functions pdx1) + rate limit + burst-test; video; adversarial
   review x2 engines; package (Google Form, not Devpost); freeze.

## Operator-held
- Redeem Trigger promo: cloud.trigger.dev/promo?code=clickhack2026 ($100).
- Acceptance email: raffle social-post requirement check.
- Submission form (staged): docs.google.com/forms/d/1J9CHKEx7CHy5efUWsZDh3z0_ZUPALox8SHvlmh7m7Dc/viewform
