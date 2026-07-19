import type { AgentPulse as Pulse } from "@/core/telemetry";

export function AgentPulse({ pulse }: { pulse: Pulse | null }) {
  if (!pulse) return null;
  return (
    <section aria-label="agent pulse" data-testid="agent-pulse">
      <p className="mb-2 text-xs uppercase tracking-widest text-zinc-600">
        agent pulse, last 24h (from its own sq_ticks telemetry in ClickHouse)
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 font-mono text-xs text-zinc-400">
        <span>
          <span className="text-zinc-200">{pulse.silent.toLocaleString()}</span> silent sweeps
        </span>
        <span>
          <span className="text-sky-300">{pulse.delta.toLocaleString()}</span> deltas told
        </span>
        <span>
          <span className={pulse.error > 0 ? "text-amber-300" : "text-zinc-200"}>
            {pulse.error.toLocaleString()}
          </span>{" "}
          errors
        </span>
        <span>
          <span className="text-zinc-200">{pulse.avgMs.toLocaleString()}ms</span> avg evaluation
        </span>
      </div>
    </section>
  );
}
