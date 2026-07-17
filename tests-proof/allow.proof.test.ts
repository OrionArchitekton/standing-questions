import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileQuestion } from "../src/core/compile";
import { evaluatePlan } from "../src/core/evaluate";
import { firehoseSchema } from "../src/core/firehose-schema";
import { makeAnthropicProposer } from "../src/core/propose";
import { renderVerdict } from "../src/core/verdict";

const CH_URL = process.env.CH_TEST_URL ?? "http://localhost:8123";
const KEY = process.env.ANTHROPIC_API_KEY;

describe.runIf(Boolean(KEY))("S1 live ALLOW proof: real model + real ClickHouse", () => {
  it("compiles a real question with claude-sonnet-5 and renders a Living Answer", async () => {
    const question = "How many posts per hour were created yesterday?";
    const live = makeAnthropicProposer(KEY!);
    let rawReply = "";
    const recording = async (prompt: string) => {
      try {
        rawReply = await live(prompt);
      } catch (e) {
        console.error("proposer threw:", e instanceof Error ? e.message : e);
        throw e;
      }
      return rawReply;
    };
    const compiled = await compileQuestion(question, firehoseSchema, recording);
    if (!compiled.ok) {
      console.error("compile failed:", compiled.reason, "| raw reply head:", rawReply.slice(0, 400));
    }
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const evaluated = await evaluatePlan(compiled.plan, { url: CH_URL });
    expect(evaluated.ok).toBe(true);
    if (!evaluated.ok) return;

    const verdict = renderVerdict(compiled.plan.verdict.template, evaluated.snapshot.stat);
    expect(verdict.length).toBeGreaterThan(0);
    expect(verdict).not.toMatch(/[–—―]/);

    mkdirSync("docs/proofs", { recursive: true });
    writeFileSync(
      "docs/proofs/allow-proof.json",
      JSON.stringify(
        {
          provedAt: new Date().toISOString(),
          question,
          model: "claude-sonnet-5",
          clickhouse: CH_URL.includes("localhost") ? "local 26.7 (seeded)" : "cloud",
          sql: compiled.plan.sql,
          chart: compiled.plan.chart,
          verdict,
          seriesPoints: evaluated.snapshot.series.length,
        },
        null,
        2,
      ),
    );
  });
});
