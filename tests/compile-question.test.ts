import { describe, expect, it } from "vitest";
import { buildCompilePrompt, compileQuestion } from "../src/core/compile";
import type { FirehoseSchema } from "../src/core/plan";

const schema: FirehoseSchema = {
  tables: [
    {
      name: "bluesky_events",
      columns: ["ts", "kind", "lang", "text_len"],
      description: "one row per Bluesky Jetstream event",
    },
  ],
};

const validPlanJson = JSON.stringify({
  sql: "SELECT toStartOfHour(ts) AS t, count() AS v FROM bluesky_events WHERE ts > now() - INTERVAL 24 HOUR GROUP BY t ORDER BY t LIMIT 1000",
  chart: { type: "line", x: "t", y: "v", title: "Posts per hour, last 24h" },
  verdict: { template: "Last hour: {stat} events" },
  deltaRule: { kind: "regime", window: 3, minRatio: 2 },
});

const propose = (reply: string) => async () => reply;

describe("compileQuestion (spec S1: typed, fail-closed model boundary)", () => {
  it("compiles a valid model reply into an accepted ChartPlan", async () => {
    const r = await compileQuestion("posts per hour today?", schema, propose(validPlanJson));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.chart.type).toBe("line");
      expect(r.plan.sql).toMatch(/^SELECT/i);
      expect(r.plan.deltaRule.kind).toBe("regime");
    }
  });

  it("rejects malformed JSON as malformed, never throws", async () => {
    const r = await compileQuestion("q", schema, propose("this is not json {"));
    expect(r).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a schema-valid reply whose SQL touches a non-allowlisted table", async () => {
    const bad = JSON.parse(validPlanJson);
    bad.sql = "SELECT count() AS v, now() AS t FROM system.tables LIMIT 10";
    const r = await compileQuestion("q", schema, propose(JSON.stringify(bad)));
    expect(r).toEqual({ ok: false, reason: "disallowed" });
  });

  it("rejects non-SELECT statements", async () => {
    const bad = JSON.parse(validPlanJson);
    bad.sql = "INSERT INTO bluesky_events VALUES (now(),'x','en',1)";
    const r = await compileQuestion("q", schema, propose(JSON.stringify(bad)));
    expect(r).toEqual({ ok: false, reason: "disallowed" });
  });

  it("rejects multi-statement SQL", async () => {
    const bad = JSON.parse(validPlanJson);
    bad.sql =
      "SELECT count() AS v, now() AS t FROM bluesky_events LIMIT 10; DROP TABLE bluesky_events";
    const r = await compileQuestion("q", schema, propose(JSON.stringify(bad)));
    expect(r).toEqual({ ok: false, reason: "disallowed" });
  });

  it("rejects SQL without a LIMIT", async () => {
    const bad = JSON.parse(validPlanJson);
    bad.sql = "SELECT count() AS v, now() AS t FROM bluesky_events GROUP BY t ORDER BY t";
    const r = await compileQuestion("q", schema, propose(JSON.stringify(bad)));
    expect(r).toEqual({ ok: false, reason: "disallowed" });
  });

  it("maps an explicit model refusal to refusal", async () => {
    const r = await compileQuestion("q", schema, propose("REFUSE: cannot answer this"));
    expect(r).toEqual({ ok: false, reason: "refusal" });
  });

  it("maps a proposer throw (timeout) to timeout, never throws", async () => {
    const r = await compileQuestion("q", schema, async () => {
      throw new Error("deadline");
    });
    expect(r).toEqual({ ok: false, reason: "timeout" });
  });

  it("prompt carries the schema, the JSON contract, and the style ban", () => {
    const p = buildCompilePrompt("posts per hour today?", schema);
    expect(p).toContain("bluesky_events");
    expect(p).toContain("JSON");
    expect(p.toLowerCase()).toContain("select");
    expect(p).toMatch(/dash/i);
  });
});
