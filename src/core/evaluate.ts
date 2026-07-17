import { createClient } from "@clickhouse/client";
import type { ChartPlan } from "./plan";
import type { Snapshot } from "./types";

export type ChConn = {
  url: string;
  username?: string;
  password?: string;
  pingTimeoutMs?: number;
};

export type EvaluateResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; reason: "query_error" | "unreachable" };

export async function evaluatePlan(plan: ChartPlan, conn: ChConn): Promise<EvaluateResult> {
  const client = createClient({
    url: conn.url,
    username: conn.username ?? "default",
    password: conn.password ?? "",
    request_timeout: 15_000,
  });
  try {
    const ping = await Promise.race([
      client.ping(),
      new Promise<{ success: false }>((resolve) =>
        setTimeout(() => resolve({ success: false }), conn.pingTimeoutMs ?? 2_500),
      ),
    ]);
    if (!ping.success) return { ok: false, reason: "unreachable" };

    let rows: Record<string, unknown>[];
    try {
      const rs = await client.query({ query: plan.sql, format: "JSONEachRow" });
      rows = await rs.json<Record<string, unknown>>();
    } catch {
      return { ok: false, reason: "query_error" };
    }

    const series = rows.map((r) => ({
      t: String(r[plan.chart.x]),
      v: Number(r[plan.chart.y]),
    }));
    return {
      ok: true,
      snapshot: {
        capturedAt: new Date().toISOString(),
        series,
        stat: series.length > 0 ? series[series.length - 1].v : 0,
      },
    };
  } finally {
    await client.close();
  }
}
