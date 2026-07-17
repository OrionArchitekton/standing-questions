import type { WatchRow } from "@/core/olap-join";
import { shortLabel } from "@/core/chart-geometry";

export function StandingWatch({ rows }: { rows: WatchRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="standing watch" data-testid="standing-watch">
      <p className="mb-2 text-xs uppercase tracking-widest text-zinc-600">
        standing watch (told-ledger joined against the live firehose in ClickHouse)
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
          >
            <span className="text-sm text-zinc-300">{row.question}</span>
            <span className="text-xs text-zinc-500">
              <span className="font-mono text-emerald-300">
                {row.eventsSince.toLocaleString("en-US")}
              </span>{" "}
              firehose events since the agent last spoke ({shortLabel(row.since)} UTC)
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
