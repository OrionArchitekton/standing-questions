import type { SeriesPoint } from "./types";

export type Box = { width: number; height: number; pad: number };
export type Pt = { x: number; y: number };
export type BarRect = { x: number; y: number; w: number; h: number };

function vRange(series: SeriesPoint[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of series) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  return { min, max };
}

export function scalePoints(series: SeriesPoint[], box: Box): Pt[] {
  if (series.length === 0) return [];
  const innerW = box.width - 2 * box.pad;
  const innerH = box.height - 2 * box.pad;
  const { min, max } = vRange(series);
  const span = max - min;
  return series.map((p, i) => {
    const x =
      series.length === 1 ? box.width / 2 : box.pad + (i / (series.length - 1)) * innerW;
    const y =
      span === 0 ? box.height / 2 : box.pad + (1 - (p.v - min) / span) * innerH;
    return { x, y };
  });
}

export function pathFor(type: "line" | "area", pts: Pt[], box: Box): string {
  if (pts.length === 0) return "";
  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)},${round(p.y)}`)
    .join(" ");
  if (type === "line") return line;
  const floor = round(box.height - box.pad);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${line} L${round(last.x)},${floor} L${round(first.x)},${floor} Z`;
}

export function barRects(series: SeriesPoint[], box: Box): BarRect[] {
  if (series.length === 0) return [];
  const innerW = box.width - 2 * box.pad;
  const innerH = box.height - 2 * box.pad;
  const { min, max } = vRange(series);
  const floorV = Math.min(0, min);
  const span = max - floorV || 1;
  const slot = innerW / series.length;
  const w = Math.max(1, slot * 0.7);
  return series.map((p, i) => {
    const h = ((p.v - floorV) / span) * innerH;
    return {
      x: box.pad + i * slot + (slot - w) / 2,
      y: box.height - box.pad - h,
      w,
      h,
    };
  });
}

export function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count < 2) return [];
  const span = max - min || 1;
  const rawStep = span / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step / 2; t += step) {
    ticks.push(round(t));
  }
  return ticks;
}

export function shortLabel(t: string): string {
  const m = t.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})/);
  return m ? m[1] : t;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
