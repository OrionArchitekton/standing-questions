import { describe, expect, it } from "vitest";
import { sqlAllowed } from "../src/core/compile";
import { firehoseSchema } from "../src/core/firehose-schema";
import { chartPlanSchema } from "../src/core/plan";

// The gate is re-applied outside compile (at /api/pin and in the re-eval cron),
// so its contract is pinned here independently of compileQuestion.
describe("sqlAllowed (re-validation gate for stored/client plans)", () => {
  it("accepts a gated single SELECT over an allowlisted table with LIMIT", () => {
    expect(
      sqlAllowed(
        "SELECT toStartOfHour(ts) AS hour, count() AS posts FROM bluesky_events GROUP BY hour ORDER BY hour LIMIT 24",
        firehoseSchema,
      ),
    ).toBe(true);
  });

  it("rejects writes, foreign tables, missing LIMIT, and stacked statements", () => {
    expect(sqlAllowed("DROP TABLE bluesky_events", firehoseSchema)).toBe(false);
    expect(sqlAllowed("SELECT * FROM system.tables LIMIT 5", firehoseSchema)).toBe(false);
    expect(sqlAllowed("SELECT count() FROM bluesky_events", firehoseSchema)).toBe(false);
    expect(
      sqlAllowed("SELECT 1 FROM bluesky_events LIMIT 1; SELECT 2 FROM bluesky_events LIMIT 1", firehoseSchema),
    ).toBe(false);
    expect(
      sqlAllowed("INSERT INTO bluesky_events SELECT * FROM bluesky_events LIMIT 1", firehoseSchema),
    ).toBe(false);
  });
});

describe("regime minRatio schema constraint", () => {
  const base = {
    sql: "SELECT toStartOfHour(ts) AS hour, count() AS posts FROM bluesky_events GROUP BY hour LIMIT 24",
    chart: { type: "line", x: "hour", y: "posts", title: "Posts per hour" },
    verdict: { template: "Latest is {stat}" },
  };

  it("rejects minRatio <= 1 (would fire on an ordinary evaluation)", () => {
    for (const minRatio of [0.5, 1]) {
      const parsed = chartPlanSchema.safeParse({
        ...base,
        deltaRule: { kind: "regime", window: 6, minRatio },
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("accepts minRatio > 1", () => {
    const parsed = chartPlanSchema.safeParse({
      ...base,
      deltaRule: { kind: "regime", window: 6, minRatio: 1.5 },
    });
    expect(parsed.success).toBe(true);
  });
});
