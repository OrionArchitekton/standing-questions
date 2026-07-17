import { NextResponse } from "next/server";
import { compileQuestion } from "@/core/compile";
import { evaluatePlan } from "@/core/evaluate";
import { firehoseSchema } from "@/core/firehose-schema";
import { makeAnthropicProposer } from "@/core/propose";
import { renderVerdict } from "@/core/verdict";

export const runtime = "nodejs";

const FAIL_MESSAGES: Record<string, string> = {
  refusal: "The agent declined: this question cannot be answered from the firehose tables.",
  malformed: "The agent's plan did not validate. Nothing was executed.",
  disallowed: "The compiled query failed the safety gate. Nothing was executed.",
  timeout: "The planner timed out before producing a valid plan.",
  query_error: "The plan compiled but ClickHouse rejected the query.",
  unreachable: "The data layer is unreachable right now.",
};

export async function POST(req: Request): Promise<NextResponse> {
  let question: unknown;
  try {
    ({ question } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 300) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const chUrl = process.env.CLICKHOUSE_URL;
  if (!apiKey || !chUrl) {
    return NextResponse.json(
      { ok: false, reason: "unconfigured", message: FAIL_MESSAGES.unreachable },
      { status: 503 },
    );
  }

  const compiled = await compileQuestion(
    question.trim(),
    firehoseSchema,
    makeAnthropicProposer(apiKey),
  );
  if (!compiled.ok) {
    return NextResponse.json(
      { ok: false, reason: compiled.reason, message: FAIL_MESSAGES[compiled.reason] },
      { status: 422 },
    );
  }

  const evaluated = await evaluatePlan(compiled.plan, {
    url: chUrl,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });
  if (!evaluated.ok) {
    return NextResponse.json(
      { ok: false, reason: evaluated.reason, message: FAIL_MESSAGES[evaluated.reason] },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    card: {
      chart: compiled.plan.chart,
      verdict: renderVerdict(compiled.plan.verdict.template, evaluated.snapshot.stat),
      snapshot: evaluated.snapshot,
      sql: compiled.plan.sql,
      deltaRule: compiled.plan.deltaRule,
    },
  });
}
