import { createClient } from "@clickhouse/client";
import { logger, metadata, schedules, tags } from "@trigger.dev/sdk";
import { sqlAllowed } from "../core/compile";
import { listActiveStandingQuestions, recordEvaluation, recordTold } from "../core/db";
import { diffSnapshots } from "../core/diff";
import { evaluatePlan } from "../core/evaluate";
import { firehoseSchema } from "../core/firehose-schema";
import { formatChTs } from "../core/jetstream";
import { renderVerdict } from "../core/verdict";

type TickRow = {
  ts: string;
  standing_question_id: string;
  outcome: "silent" | "delta" | "error";
  eval_ms: number;
};

/**
 * One evaluation sweep over all active standing questions; shared by the
 * scheduled task and the proof harness. Baseline moves ONLY when a delta
 * fires (baseline = what the subscriber was last told), so slow drifts
 * accumulate until the rule triggers instead of being silently absorbed.
 */
export async function runReevalOnce(): Promise<{
  evaluated: number;
  deltas: number;
  errors: number;
}> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) throw new Error("CLICKHOUSE_URL is not set");
  const chConn = {
    url,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  };

  const questions = await listActiveStandingQuestions();
  const ticks: TickRow[] = [];
  let deltas = 0;
  let errors = 0;

  for (const q of questions) {
    const started = Date.now();
    // Defense in depth: rows reach Postgres via /api/pin, so never execute a
    // stored plan the gate would not pass today (fail-closed, not grandfathered).
    if (!sqlAllowed(q.plan.sql, firehoseSchema)) {
      errors++;
      ticks.push({
        ts: formatChTs(Date.now()),
        standing_question_id: q.id,
        outcome: "error",
        eval_ms: Date.now() - started,
      });
      continue;
    }
    const evaluated = await evaluatePlan(q.plan, chConn);
    let outcome: TickRow["outcome"] = "silent";

    if (!evaluated.ok) {
      outcome = "error";
      errors++;
      await recordEvaluation(q.id, null);
    } else {
      const delta = diffSnapshots(q.baseline, evaluated.snapshot, q.plan.deltaRule);
      if (delta) {
        outcome = "delta";
        deltas++;
        const verdict = renderVerdict(q.plan.verdict.template, evaluated.snapshot.stat);
        await recordTold(q.id, q.plan.deltaRule, q.baseline, evaluated.snapshot, verdict);
        await recordEvaluation(q.id, evaluated.snapshot);
      } else {
        await recordEvaluation(q.id, null);
      }
    }
    ticks.push({
      ts: formatChTs(Date.now()),
      standing_question_id: q.id,
      outcome,
      eval_ms: Date.now() - started,
    });
  }

  if (ticks.length > 0) {
    const ch = createClient({ ...chConn, request_timeout: 30_000 });
    try {
      await ch.insert({ table: "sq_ticks", values: ticks, format: "JSONEachRow" });
    } finally {
      await ch.close();
    }
  }

  return { evaluated: questions.length, deltas, errors };
}

/**
 * Every 10 minutes: re-evaluate every active standing question against
 * ClickHouse Cloud, diff against the told-baseline, append the Told-Ledger
 * and telemetry. The run's metadata carries the sweep result for Realtime
 * observers and the dashboard.
 */
export const reevalStandingQuestions = schedules.task({
  id: "reeval-standing-questions",
  cron: "*/10 * * * *",
  maxDuration: 300,
  queue: { concurrencyLimit: 1 },
  run: async () => {
    await tags.add("sq"); // Realtime subscribers watch this tag
    const result = await runReevalOnce();
    metadata.set("evaluated", result.evaluated).set("deltas", result.deltas);
    logger.log("standing re-eval sweep", result);
    return result;
  },
});
