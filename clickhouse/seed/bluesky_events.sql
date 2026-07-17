-- Local-dev seed: ~400 events spread over the last ~47 hours, relative to
-- now() so "today"-style questions always have data. Reapply any time:
-- clickhousectl local client --name standing-questions --queries-file clickhouse/seed/bluesky_events.sql
TRUNCATE TABLE bluesky_events;

INSERT INTO bluesky_events
SELECT
    now() - INTERVAL (number * 7) MINUTE AS ts,
    'commit' AS kind,
    ['app.bsky.feed.post', 'app.bsky.feed.like', 'app.bsky.graph.follow'][(number % 3) + 1] AS collection,
    if(number % 11 = 0, 'delete', 'create') AS operation,
    if(collection = 'app.bsky.feed.post', ['en', 'es', 'ja', 'pt', 'de'][(number % 5) + 1], '') AS lang,
    concat('did:plc:seed', toString(number % 40)) AS did,
    if(collection = 'app.bsky.feed.post', toUInt16(20 + (number * 37) % 260), 0) AS text_len
FROM numbers(400);
