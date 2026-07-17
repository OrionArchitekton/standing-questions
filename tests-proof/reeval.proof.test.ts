import { neon } from "@neondatabase/serverless";
import { afterAll, describe, expect, it } from "vitest";
import { pinStandingQuestion } from "../src/core/db";
import type { ChartPlan } from "../src/core/plan";
import { runReevalOnce } from "../src/trigger/reeval";

const configured = Boolean(process.env.CLICKHOUSE_URL && process.env.DATABASE_URL);
let pinnedId: string | null = null;

const plan: ChartPlan = {
  sql: "SELECT toStartOfMinute(ts) AS t, count() AS v FROM bluesky_events WHERE ts > now() - INTERVAL 1 HOUR GROUP BY t ORDER BY t LIMIT 100",
  chart: { type: "line", x: "t", y: "v", title: "Events per minute, last hour" },
  verdict: { template: "Latest minute saw {stat} events" },
  deltaRule: { kind: "threshold", stat: "last", crossesAbove: 1 },
};

const baseline = {
  capturedAt: "2026-07-17T00:00:00.000Z",
  series: [{ t: "2026-07-17 00:00:00", v: 0 }],
  stat: 0,
};

describe.runIf(configured)("live re-eval proof: pinned question -> delta -> told ledger", () => {
  afterAll(async () => {
    if (pinnedId && process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      await sql.query("DELETE FROM standing_questions WHERE id = $1", [pinnedId]);
    }
  });

  it("fires the threshold rule against real ingested data and appends the ledger", async () => {
    const pinned = await pinStandingQuestion("PROOF: events per minute last hour", plan, baseline);
    pinnedId = pinned.id;

    const result = await runReevalOnce();
    console.log("reeval proof result:", JSON.stringify(result));
    expect(result.evaluated).toBeGreaterThanOrEqual(1);
    expect(result.errors).toBe(0);
    expect(result.deltas).toBeGreaterThanOrEqual(1);

    const sql = neon(process.env.DATABASE_URL as string);
    const ledger = await sql.query(
      "SELECT verdict, rule FROM told_ledger WHERE standing_question_id = $1",
      [pinnedId],
    );
    expect((ledger as { verdict: string }[]).length).toBe(1);
    expect((ledger as { verdict: string }[])[0].verdict).toMatch(/events/);

    const updated = await sql.query(
      "SELECT baseline, last_evaluated_at FROM standing_questions WHERE id = $1",
      [pinnedId],
    );
    const row = (updated as { baseline: { stat: number }; last_evaluated_at: string }[])[0];
    expect(row.last_evaluated_at).toBeTruthy();
    expect(row.baseline.stat).toBeGreaterThan(0); // baseline moved to what we told
  }, 55_000);
});
