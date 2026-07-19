import { describe, expect, it } from "vitest";
import { barRects, niceTicks, pathFor, scalePoints, shortLabel } from "../src/core/chart-geometry";
import type { SeriesPoint } from "../src/core/types";

const box = { width: 100, height: 50, pad: 10 };

const series: SeriesPoint[] = [
  { t: "2026-07-17 12:00:00", v: 0 },
  { t: "2026-07-17 13:00:00", v: 5 },
  { t: "2026-07-17 14:00:00", v: 10 },
];

describe("chart geometry (pure seam under LivingAnswerCard)", () => {
  it("scales points into the padded box, y inverted (max value at top)", () => {
    const pts = scalePoints(series, box);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 10, y: 40 }); // v=0 -> bottom
    expect(pts[2]).toEqual({ x: 90, y: 10 }); // v=max -> top
    expect(pts[1].y).toBeCloseTo(25); // midpoint
  });

  it("handles a flat series without dividing by zero (centers the line)", () => {
    const flat = [
      { t: "a", v: 7 },
      { t: "b", v: 7 },
    ];
    const pts = scalePoints(flat, box);
    expect(pts.every((p) => Number.isFinite(p.y))).toBe(true);
    expect(pts[0].y).toBe(pts[1].y);
  });

  it("handles a single-point series (centers the point horizontally)", () => {
    const pts = scalePoints([{ t: "a", v: 3 }], box);
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBe(50);
    expect(Number.isFinite(pts[0].y)).toBe(true);
  });

  it("returns an empty path for an empty series, never NaN in output", () => {
    expect(scalePoints([], box)).toEqual([]);
    expect(pathFor("line", [], box)).toBe("");
    expect(pathFor("area", [], box)).toBe("");
  });

  it("builds a line path M..L.. through every point", () => {
    const d = pathFor("line", scalePoints(series, box), box);
    expect(d.startsWith("M")).toBe(true);
    expect(d.match(/L/g)).toHaveLength(2);
    expect(d).not.toMatch(/NaN/);
  });

  it("builds a closed area path dropping to the box floor", () => {
    const d = pathFor("area", scalePoints(series, box), box);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("40"); // floor y = height - pad
  });

  it("builds bar rects with positive width and height clamped to the box", () => {
    const rects = barRects(series, box);
    expect(rects).toHaveLength(3);
    for (const r of rects) {
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(box.height - box.pad + 0.001);
    }
    // tallest bar corresponds to v=10
    expect(Math.max(...rects.map((r) => r.h))).toBeCloseTo(30);
  });

  it("niceTicks returns ascending round values spanning the range", () => {
    const ticks = niceTicks(0, 97, 4);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect([...ticks]).toEqual([...ticks].sort((a, b) => a - b));
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(97);
  });

  it("shortLabel trims ClickHouse datetimes to HH:MM and leaves plain labels alone", () => {
    expect(shortLabel("2026-07-17 14:00:00")).toBe("14:00");
    expect(shortLabel("2026-07-17T14:30:00")).toBe("14:30");
    expect(shortLabel("en")).toBe("en");
  });
});

describe("scalePoints shared domain (before/after pairs)", () => {
  const box = { width: 640, height: 240, pad: 30 };
  it("maps the same value to the same y across two series when a domain is shared", () => {
    const domain = { min: 0, max: 100 };
    const a = scalePoints([{ t: "1", v: 50 }, { t: "2", v: 100 }], box, domain);
    const b = scalePoints([{ t: "1", v: 0 }, { t: "2", v: 50 }], box, domain);
    expect(a[0].y).toBe(b[1].y); // v=50 lands identically in both charts
  });
  it("auto-ranges per series when no domain is given (existing behavior)", () => {
    const a = scalePoints([{ t: "1", v: 50 }, { t: "2", v: 100 }], box);
    const b = scalePoints([{ t: "1", v: 0 }, { t: "2", v: 50 }], box);
    expect(a[0].y).not.toBe(b[1].y);
  });
});
