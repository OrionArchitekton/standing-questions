import type { ChartPlan } from "./plan";
import type { DeltaRule, Snapshot } from "./types";

export type LivingCard = {
  chart: ChartPlan["chart"];
  verdict: string;
  snapshot: Snapshot;
  sql: string;
  deltaRule: DeltaRule;
};

export type AskFailure = {
  ok: false;
  reason: string;
  message: string;
  status: number;
};

export type AskResult = { ok: true; card: LivingCard } | AskFailure;
