import {
  type Box,
  barRects,
  niceTicks,
  pathFor,
  scalePoints,
  shortLabel,
} from "@/core/chart-geometry";
import type { SeriesPoint } from "@/core/types";

const BOX: Box = { width: 640, height: 240, pad: 30 };

export function ChartSvg({
  type,
  series,
}: {
  type: "line" | "bar" | "area";
  series: SeriesPoint[];
}) {
  if (series.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-zinc-800 text-sm text-zinc-500">
        The query ran but returned no data points.
      </div>
    );
  }

  const values = series.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerH = BOX.height - 2 * BOX.pad;
  const ticks = span === 0 ? [min] : niceTicks(min, max, 4);
  const yFor = (v: number) =>
    span === 0 ? BOX.height / 2 : BOX.pad + (1 - (v - min) / span) * innerH;

  const pts = scalePoints(series, BOX);
  const labelIdx =
    series.length <= 2 ? series.map((_, i) => i) : [0, Math.floor(series.length / 2), series.length - 1];

  return (
    <svg
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      className="w-full"
      role="img"
      aria-label="chart"
      data-testid="living-chart"
    >
      {ticks.map((t) => {
        const y = yFor(t);
        if (y < BOX.pad - 1 || y > BOX.height - BOX.pad + 1) return null;
        return (
          <g key={t}>
            <line
              x1={BOX.pad}
              x2={BOX.width - BOX.pad}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-zinc-800"
              strokeWidth="1"
            />
            <text
              x={BOX.pad - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-zinc-500 text-[10px]"
            >
              {formatTick(t)}
            </text>
          </g>
        );
      })}
      {type === "bar" ? (
        barRects(series, BOX).map((r, i) => (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx="1.5"
            className="fill-emerald-400/80"
          />
        ))
      ) : (
        <>
          {type === "area" && (
            <path d={pathFor("area", pts, BOX)} className="fill-emerald-400/15" />
          )}
          <path
            d={pathFor("line", pts, BOX)}
            fill="none"
            strokeWidth="2"
            className="stroke-emerald-400"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {pts.length <= 40 &&
            pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.5" className="fill-emerald-300" />
            ))}
        </>
      )}
      {labelIdx.map((i) => (
        <text
          key={i}
          x={pts[i].x}
          y={BOX.height - BOX.pad + 16}
          textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}
          className="fill-zinc-500 text-[10px]"
        >
          {shortLabel(series[i].t)}
        </text>
      ))}
    </svg>
  );
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
