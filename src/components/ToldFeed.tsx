import type { ToldLedgerRow } from "@/core/db";
import { ChartSvg } from "./ChartSvg";

function statLine(row: ToldLedgerRow): string {
  return `${row.before_snapshot.stat} -> ${row.after_snapshot.stat}`;
}

export function ToldFeed({ rows }: { rows: ToldLedgerRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="reopened threads" data-testid="told-feed">
      <p className="mb-2 text-xs uppercase tracking-widest text-zinc-600">
        threads the agent reopened
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-zinc-200">{row.question}</span>
              <span className="font-mono text-xs text-sky-300">{statLine(row)}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">{row.verdict}</p>
            {row.before_snapshot.series.length > 0 && row.after_snapshot.series.length > 0 && (() => {
              // One y-domain across the pair: the same change must not look
              // larger on one side because its axis auto-ranged tighter.
              const vs = [...row.before_snapshot.series, ...row.after_snapshot.series].map((p) => p.v);
              const domain = { min: Math.min(...vs), max: Math.max(...vs) };
              return (
                <div className="mt-3 grid grid-cols-2 gap-3" data-testid="delta-visual">
                  <figure className="opacity-50">
                    <figcaption className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                      before (what you were last told)
                    </figcaption>
                    <ChartSvg type="line" series={row.before_snapshot.series} domain={domain} />
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-[10px] uppercase tracking-widest text-sky-400">
                      after (when the rule fired)
                    </figcaption>
                    <ChartSvg type="line" series={row.after_snapshot.series} domain={domain} />
                  </figure>
                </div>
              );
            })()}
            <p className="mt-2 text-[11px] text-zinc-600">
              rule {row.rule.kind} fired at {new Date(row.told_at).toISOString().slice(0, 16).replace("T", " ")} UTC
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
