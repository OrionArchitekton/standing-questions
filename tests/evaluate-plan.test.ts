import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { evaluatePlan } from "../src/core/evaluate";
import type { ChartPlan } from "../src/core/plan";

const CH_URL = process.env.CH_TEST_URL ?? "http://localhost:8123";

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(`${CH_URL}/ping`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

const plan: ChartPlan = {
  sql: "SELECT toStartOfHour(ts) AS t, count() AS v FROM bluesky_events WHERE collection = 'app.bsky.feed.post' GROUP BY t ORDER BY t LIMIT 1000",
  chart: { type: "line", x: "t", y: "v", title: "Posts per hour" },
  verdict: { template: "Last hour: {stat} posts" },
  deltaRule: { kind: "regime", window: 3, minRatio: 2 },
};

describe.runIf(await reachable())("evaluatePlan (spec S1 seam 2, live local ClickHouse)", () => {
  let client: ClickHouseClient;

  beforeAll(async () => {
    client = createClient({ url: CH_URL });
    const ddl = readFileSync("clickhouse/tables/bluesky_events.sql", "utf8")
      .replace(/^--.*$/gm, "")
      .trim();
    await client.command({ query: ddl });
    await client.command({ query: "TRUNCATE TABLE bluesky_events" });
    const rows = Array.from({ length: 48 }, (_, i) => ({
      ts: `2026-07-16 ${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}:00`,
      kind: "commit",
      collection: "app.bsky.feed.post",
      operation: "create",
      lang: "en",
      did: `did:plc:test${i}`,
      text_len: 100 + i,
    }));
    await client.insert({ table: "bluesky_events", values: rows, format: "JSONEachRow" });
  });

  afterAll(async () => {
    await client?.close();
  });

  it("executes the plan and returns a Snapshot shaped by the chart axes", async () => {
    const r = await evaluatePlan(plan, { url: CH_URL });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.snapshot.series.length).toBe(24);
      expect(r.snapshot.series.every((p) => p.v === 2)).toBe(true);
      expect(r.snapshot.stat).toBe(2);
      expect(new Date(r.snapshot.capturedAt).getTime()).not.toBeNaN();
    }
  });

  it("orders the series by the x axis ascending", async () => {
    const r = await evaluatePlan(plan, { url: CH_URL });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ts = r.snapshot.series.map((p) => p.t);
      expect([...ts].sort()).toEqual(ts);
    }
  });

  it("maps a query error to a typed failure, never throws", async () => {
    const bad: ChartPlan = { ...plan, sql: "SELECT nonsense_column FROM bluesky_events LIMIT 10" };
    const r = await evaluatePlan(bad, { url: CH_URL });
    expect(r).toEqual({ ok: false, reason: "query_error" });
  });

  it("maps an unreachable server to a typed failure", async () => {
    const r = await evaluatePlan(plan, { url: "http://localhost:59999" });
    expect(r).toEqual({ ok: false, reason: "unreachable" });
  });
});
