-- ORDER BY low-to-high cardinality (rule 1.6), filter columns prioritized (1.8),
-- time-window scans ride the ts suffix (1.3). No partitioning for a one-week
-- dataset (1.2). LowCardinality per 1.12; minimal bit widths per 1.5; empty
-- string over Nullable per 1.1.
CREATE TABLE IF NOT EXISTS bluesky_events (
    ts DateTime('UTC'),
    kind LowCardinality(String),
    collection LowCardinality(String),
    operation LowCardinality(String),
    lang LowCardinality(String),
    did String,
    text_len UInt16
)
ENGINE = MergeTree
ORDER BY (kind, collection, ts)
