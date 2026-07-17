import { createClient } from "@clickhouse/client";
import { logger, schedules } from "@trigger.dev/sdk";
import { type BlueskyEventRow, jetstreamEventToRow } from "../core/jetstream";

const JETSTREAM_URL =
  "wss://jetstream2.us-west.bsky.network/subscribe" +
  "?wantedCollections=app.bsky.feed.post" +
  "&wantedCollections=app.bsky.feed.like" +
  "&wantedCollections=app.bsky.graph.follow";

const CAPTURE_WINDOW_MS = 25_000;
const MAX_ROWS = 60_000;

/**
 * Bounded Jetstream capture: connect, collect mapped rows for the window (or
 * until MAX_ROWS), close. Resolves with whatever was captured; rejects only
 * when the connection fails before any data arrived.
 */
export function captureJetstream(
  windowMs = CAPTURE_WINDOW_MS,
  maxRows = MAX_ROWS,
): Promise<BlueskyEventRow[]> {
  return new Promise((resolve, reject) => {
    const rows: BlueskyEventRow[] = [];
    const ws = new WebSocket(JETSTREAM_URL);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      resolve(rows);
    };
    const timer = setTimeout(finish, windowMs);
    ws.addEventListener("message", (ev) => {
      try {
        const row = jetstreamEventToRow(JSON.parse(String(ev.data)));
        if (row) rows.push(row);
        if (rows.length >= maxRows) finish();
      } catch {
        // skip malformed frames
      }
    });
    ws.addEventListener("error", () => {
      if (rows.length > 0) return finish();
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("jetstream connection failed before any event arrived"));
    });
    ws.addEventListener("close", finish);
  });
}

/** One capture-and-insert cycle; shared by the scheduled task and the proof harness. */
export async function runIngestOnce(
  windowMs = CAPTURE_WINDOW_MS,
): Promise<{ inserted: number; firstTs?: string; lastTs?: string }> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) throw new Error("CLICKHOUSE_URL is not set");

  const rows = await captureJetstream(windowMs);
  if (rows.length === 0) return { inserted: 0 };

  const ch = createClient({
    url,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    request_timeout: 30_000,
  });
  try {
    await ch.insert({ table: "bluesky_events", values: rows, format: "JSONEachRow" });
  } finally {
    await ch.close();
  }
  return { inserted: rows.length, firstTs: rows[0]?.ts, lastTs: rows[rows.length - 1]?.ts };
}

/**
 * Every 5 minutes: capture a bounded 25s slice of the Bluesky firehose and
 * batch-insert it into ClickHouse Cloud (single insert, well inside the
 * 10K-100K rows-per-insert guidance). Best-effort analytics ingest: a retried
 * run can re-capture a fresh window but never double-inserts the same batch.
 */
export const ingestFirehose = schedules.task({
  id: "ingest-firehose",
  cron: "*/5 * * * *",
  maxDuration: 120,
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const result = await runIngestOnce();
    logger.log("jetstream capture inserted", result);
    return result;
  },
});
