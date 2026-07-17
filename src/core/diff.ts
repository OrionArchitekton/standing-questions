import type { Delta, DeltaRule, RegimeRule, Snapshot, ThresholdRule } from "./types";

function recentMean(s: Snapshot, window: number): number | null {
  if (s.series.length < window || window <= 0) return null;
  const tail = s.series.slice(-window);
  return tail.reduce((acc, p) => acc + p.v, 0) / window;
}

function thresholdFired(before: Snapshot, after: Snapshot, rule: ThresholdRule): boolean {
  if (rule.crossesAbove !== undefined) {
    return before.stat < rule.crossesAbove && after.stat > rule.crossesAbove;
  }
  if (rule.crossesBelow !== undefined) {
    return before.stat > rule.crossesBelow && after.stat < rule.crossesBelow;
  }
  return false;
}

function regimeFired(before: Snapshot, after: Snapshot, rule: RegimeRule): boolean {
  const baseline = recentMean(before, rule.window);
  const next = recentMean(after, rule.window);
  if (baseline === null || next === null || baseline <= 0) return false;
  return next / baseline >= rule.minRatio;
}

export function diffSnapshots(
  before: Snapshot,
  after: Snapshot,
  rule: DeltaRule,
): Delta | null {
  if (before.series.length === 0 || after.series.length === 0) return null;
  const fired =
    rule.kind === "threshold"
      ? thresholdFired(before, after, rule)
      : regimeFired(before, after, rule);
  return fired ? { rule, before, after } : null;
}
