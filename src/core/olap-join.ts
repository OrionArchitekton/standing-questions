import { createClient } from "@clickhouse/client";

export type WatchRow = {
  id: string;
  question: string;
  since: string;
  eventsSince: number;
};

type RawRow = { id: string; question: string; since: string; events_since: string | number };

export function mapWatchRows(rows: RawRow[]): WatchRow[] {
  return rows
    .map((r) => ({
      id: r.id,
      question: r.question,
      since: r.since,
      eventsSince: Number(r.events_since),
    }))
    .filter((r) => Number.isFinite(r.eventsSince));
}

/**
 * The S4 join: Standing Questions and the Told-Ledger live in Postgres and
 * arrive here via ClickPipes CDC; the live firehose lives in ClickHouse.
 * "How much has flowed since the agent last spoke" is computable only where
 * the two planes meet. FINAL + _peerdb_is_deleted honor the CDC semantics
 * (ReplacingMergeTree versioned by _peerdb_version, soft deletes).
 */
const WATCH_SQL = `
WITH latest_told AS (
  SELECT standing_question_id, max(told_at) AS last_told_at
  FROM told_ledger AS tl FINAL
  WHERE tl._peerdb_is_deleted = 0
  GROUP BY standing_question_id
),
hourly AS (
  SELECT toStartOfHour(ts) AS h, count() AS c FROM bluesky_events GROUP BY h
),
base AS (
  SELECT sq.id AS id, sq.question AS question,
         -- join miss yields a zero DateTime (join_use_nulls=0), so greatest(),
         -- not coalesce(); a real told_at always exceeds created_at
         greatest(lt.last_told_at, sq.created_at) AS since
  FROM standing_questions AS sq FINAL
  LEFT JOIN latest_told AS lt ON lt.standing_question_id = sq.id
  WHERE sq._peerdb_is_deleted = 0 AND sq.status = 'active'
)
SELECT base.id AS id, base.question AS question,
       toString(base.since) AS since,
       sum(if(hourly.h >= toStartOfHour(base.since), hourly.c, 0)) AS events_since
FROM base CROSS JOIN hourly
GROUP BY id, question, since
ORDER BY since
LIMIT 50
`;

export async function sinceLastTold(): Promise<WatchRow[]> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) return [];
  const ch = createClient({
    url,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    request_timeout: 5_000,
  });
  try {
    const rs = await ch.query({ query: WATCH_SQL, format: "JSONEachRow" });
    return mapWatchRows(await rs.json<RawRow>());
  } catch {
    return []; // CDC tables absent (local dev) or transient error: render nothing
  } finally {
    await ch.close();
  }
}
