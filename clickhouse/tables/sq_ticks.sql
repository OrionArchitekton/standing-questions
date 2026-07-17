-- Self-telemetry: one row per standing-question evaluation (spec S2).
CREATE TABLE IF NOT EXISTS sq_ticks (
    ts DateTime('UTC'),
    standing_question_id String,
    outcome LowCardinality(String),
    eval_ms UInt32
)
ENGINE = MergeTree
ORDER BY (standing_question_id, ts)
