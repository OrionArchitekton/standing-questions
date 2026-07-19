-- Neon (Postgres) OLTP schema. Apply idempotently:
--   doppler run --project standing-questions --config dev --command \
--     'psql "$DATABASE_URL" -f db/schema.sql'
-- (or paste into the Neon SQL editor)

CREATE TABLE IF NOT EXISTS standing_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    plan JSONB NOT NULL,          -- the compiled ChartPlan (sql, chart, verdict, deltaRule)
    baseline JSONB NOT NULL,      -- last Snapshot the subscriber was shown
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_evaluated_at TIMESTAMPTZ,
    chat_id TEXT               -- chat session that pinned this question (thread to reopen)
);

-- Additive migration for pre-chat rows (safe to re-run).
ALTER TABLE standing_questions ADD COLUMN IF NOT EXISTS chat_id TEXT;

-- Told-Ledger: one row per time the agent decided the picture changed enough
-- to reopen the thread. CDC'd to ClickHouse via ClickPipes (bonus category).
CREATE TABLE IF NOT EXISTS told_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standing_question_id UUID NOT NULL REFERENCES standing_questions(id) ON DELETE CASCADE,
    told_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rule JSONB NOT NULL,          -- the DeltaRule that fired
    before_snapshot JSONB NOT NULL,
    after_snapshot JSONB NOT NULL,
    verdict TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_told_ledger_sq_time
    ON told_ledger (standing_question_id, told_at DESC);
