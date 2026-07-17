import { createClient } from "@clickhouse/client";
import { describe, expect, it } from "vitest";
import { runIngestOnce } from "../src/trigger/ingest";

const url = process.env.CLICKHOUSE_URL;
const configured = Boolean(url);

async function cloudCount(): Promise<number> {
  const ch = createClient({
    url: url as string,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });
  try {
    const rs = await ch.query({
      query: "SELECT count() AS c FROM bluesky_events",
      format: "JSONEachRow",
    });
    const rows = await rs.json<{ c: string }>();
    return Number(rows[0]?.c ?? 0);
  } finally {
    await ch.close();
  }
}

describe.runIf(configured)("live ingest proof: Jetstream -> ClickHouse Cloud", () => {
  it("captures a bounded window from the real firehose and lands rows in Cloud", async () => {
    const before = await cloudCount();
    const result = await runIngestOnce(8_000);
    // eslint-disable-next-line no-console
    console.log("ingest proof result:", JSON.stringify({ before, ...result }));
    expect(result.inserted).toBeGreaterThan(0);
    const after = await cloudCount();
    expect(after).toBeGreaterThanOrEqual(before + result.inserted);
  }, 55_000);
});
