import { createClient } from "@clickhouse/client";

export type AgentPulse = {
  silent: number;
  delta: number;
  error: number;
  avgMs: number;
};

type RawRow = { outcome: string; n: string | number; ms: string | number };

/** Fold sq_ticks outcome rows into one pulse; exported for unit tests. */
export function foldPulse(rows: RawRow[]): AgentPulse | null {
  const pulse: AgentPulse = { silent: 0, delta: 0, error: 0, avgMs: 0 };
  let ticks = 0;
  let msWeighted = 0;
  for (const r of rows) {
    const n = Number(r.n);
    const ms = Number(r.ms);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (r.outcome === "silent") pulse.silent = n;
    else if (r.outcome === "delta") pulse.delta = n;
    else if (r.outcome === "error") pulse.error = n;
    else continue;
    ticks += n;
    if (Number.isFinite(ms)) msWeighted += ms * n;
  }
  if (ticks === 0) return null;
  pulse.avgMs = Math.round(msWeighted / ticks);
  return pulse;
}

/**
 * The agent's own 24h heartbeat from its self-telemetry table. Progressive
 * enhancement: any failure renders as nothing, never an error.
 */
export async function agentPulse(): Promise<AgentPulse | null> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) return null;
  const ch = createClient({
    url,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    request_timeout: 5_000,
  });
  try {
    const rs = await ch.query({
      query:
        "SELECT outcome, count() AS n, avg(eval_ms) AS ms FROM sq_ticks WHERE ts > now() - INTERVAL 24 HOUR GROUP BY outcome",
      format: "JSONEachRow",
      clickhouse_settings: { readonly: "2", max_execution_time: 5 },
    });
    return foldPulse(await rs.json<RawRow>());
  } catch {
    return null;
  } finally {
    await ch.close();
  }
}
