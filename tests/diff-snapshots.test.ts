import { describe, expect, it } from "vitest";
import { diffSnapshots } from "../src/core/diff";
import type { DeltaRule, Snapshot } from "../src/core/types";

function snap(values: number[], startMs = 0, stepMs = 3_600_000): Snapshot {
  return {
    capturedAt: new Date(startMs + values.length * stepMs).toISOString(),
    series: values.map((v, i) => ({
      t: new Date(startMs + i * stepMs).toISOString(),
      v,
    })),
    stat: values[values.length - 1] ?? 0,
  };
}

const threshold: DeltaRule = { kind: "threshold", stat: "last", crossesAbove: 100 };

describe("diffSnapshots (spec S3: deterministic delta rule, never model vibes)", () => {
  it("returns null when the baseline and next are both below the threshold", () => {
    expect(diffSnapshots(snap([40, 60, 80]), snap([50, 70, 90]), threshold)).toBeNull();
  });

  it("emits a Delta exactly when the stat crosses above the threshold", () => {
    const d = diffSnapshots(snap([40, 60, 80]), snap([60, 90, 140]), threshold);
    expect(d).not.toBeNull();
    expect(d!.rule.kind).toBe("threshold");
    expect(d!.before.stat).toBe(80);
    expect(d!.after.stat).toBe(140);
  });

  it("returns null when both sides already sit above the threshold (no re-fire)", () => {
    expect(diffSnapshots(snap([120, 150]), snap([160, 180]), threshold)).toBeNull();
  });

  it("fires on the downward recross when direction is below", () => {
    const below: DeltaRule = { kind: "threshold", stat: "last", crossesBelow: 100 };
    const d = diffSnapshots(snap([140, 120]), snap([110, 60]), below);
    expect(d).not.toBeNull();
    expect(d!.after.stat).toBe(60);
  });

  it("regime rule: fires when the mean of the recent window shifts by the ratio", () => {
    const regime: DeltaRule = { kind: "regime", window: 3, minRatio: 2 };
    const calm = snap([10, 11, 9, 10, 10, 11]);
    const spike = snap([10, 11, 9, 25, 30, 28]);
    expect(diffSnapshots(calm, calm, regime)).toBeNull();
    const d = diffSnapshots(calm, spike, regime);
    expect(d).not.toBeNull();
  });

  it("regime rule: sub-ratio drift stays silent", () => {
    const regime: DeltaRule = { kind: "regime", window: 3, minRatio: 2 };
    expect(
      diffSnapshots(snap([10, 10, 10, 10, 10, 10]), snap([10, 10, 10, 12, 13, 12]), regime),
    ).toBeNull();
  });

  it("is pure: identical inputs give identical outputs and inputs are not mutated", () => {
    const a = snap([40, 80]);
    const b = snap([90, 140]);
    const before = JSON.stringify([a, b]);
    const d1 = diffSnapshots(a, b, threshold);
    const d2 = diffSnapshots(a, b, threshold);
    expect(JSON.stringify(d1)).toBe(JSON.stringify(d2));
    expect(JSON.stringify([a, b])).toBe(before);
  });

  it("empty or degenerate series never throws and never fires", () => {
    expect(diffSnapshots(snap([]), snap([]), threshold)).toBeNull();
    expect(diffSnapshots(snap([]), snap([140]), threshold)).toBeNull();
  });
});
