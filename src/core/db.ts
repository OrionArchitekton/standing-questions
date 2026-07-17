import { neon } from "@neondatabase/serverless";
import type { ChartPlan } from "./plan";
import type { DeltaRule, Snapshot } from "./types";

export type StandingQuestionRow = {
  id: string;
  question: string;
  plan: ChartPlan;
  baseline: Snapshot;
  status: "active" | "paused";
  created_at: string;
  last_evaluated_at: string | null;
};

export type ToldLedgerRow = {
  id: string;
  question: string; // joined from standing_questions
  standing_question_id: string;
  told_at: string;
  rule: DeltaRule;
  before_snapshot: Snapshot;
  after_snapshot: Snapshot;
  verdict: string;
};

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export async function pinStandingQuestion(
  question: string,
  plan: ChartPlan,
  baseline: Snapshot,
): Promise<{ id: string }> {
  const rows = await sql().query(
    "INSERT INTO standing_questions (question, plan, baseline) VALUES ($1, $2, $3) RETURNING id",
    [question, JSON.stringify(plan), JSON.stringify(baseline)],
  );
  return { id: (rows as { id: string }[])[0].id };
}

export async function listActiveStandingQuestions(): Promise<StandingQuestionRow[]> {
  const rows = await sql().query(
    "SELECT id, question, plan, baseline, status, created_at, last_evaluated_at FROM standing_questions WHERE status = 'active' ORDER BY created_at",
  );
  return rows as StandingQuestionRow[];
}

export async function recordEvaluation(
  id: string,
  baseline: Snapshot | null,
): Promise<void> {
  if (baseline) {
    await sql().query(
      "UPDATE standing_questions SET baseline = $1, last_evaluated_at = now() WHERE id = $2",
      [JSON.stringify(baseline), id],
    );
  } else {
    await sql().query("UPDATE standing_questions SET last_evaluated_at = now() WHERE id = $1", [
      id,
    ]);
  }
}

export async function recordTold(
  standingQuestionId: string,
  rule: DeltaRule,
  before: Snapshot,
  after: Snapshot,
  verdict: string,
): Promise<{ id: string }> {
  const rows = await sql().query(
    "INSERT INTO told_ledger (standing_question_id, rule, before_snapshot, after_snapshot, verdict) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [
      standingQuestionId,
      JSON.stringify(rule),
      JSON.stringify(before),
      JSON.stringify(after),
      verdict,
    ],
  );
  return { id: (rows as { id: string }[])[0].id };
}

export async function listRecentTold(limit = 20): Promise<ToldLedgerRow[]> {
  const rows = await sql().query(
    "SELECT t.*, q.question FROM told_ledger t JOIN standing_questions q ON q.id = t.standing_question_id ORDER BY t.told_at DESC LIMIT $1",
    [limit],
  );
  return rows as ToldLedgerRow[];
}
