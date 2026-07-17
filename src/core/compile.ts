import type { ChartPlan, CompileResult, FirehoseSchema } from "./plan";
import { chartPlanSchema } from "./plan";

export type Proposer = (prompt: string) => Promise<string>;

export function buildCompilePrompt(question: string, schema: FirehoseSchema): string {
  const tables = schema.tables
    .map((t) => `- ${t.name}(${t.columns.join(", ")}): ${t.description}`)
    .join("\n");
  return [
    "You compile one natural-language question about a live event stream into a strict JSON plan.",
    "",
    "Available ClickHouse tables (the ONLY tables you may query):",
    tables,
    "",
    'Reply with ONLY a JSON object, no prose, matching exactly: {"sql": string, "chart": {"type": "line"|"bar"|"area", "x": string, "y": string, "title": string}, "verdict": {"template": string}, "deltaRule": {"kind": "threshold", "stat": "last", "crossesAbove"?: number, "crossesBelow"?: number} | {"kind": "regime", "window": number, "minRatio": number}}.',
    "Rules for sql: a single SELECT statement over the tables above, aggregated to at most a few hundred points, always ending with LIMIT. No writes, no other tables, no semicolons.",
    "Rules for text fields: title at most 60 characters; verdict template one line using {stat}; never use em or en dashes in any text field.",
    "If the question cannot be answered from these tables, reply exactly: REFUSE: <ten words why>.",
    "",
    `Question: ${question}`,
  ].join("\n");
}

function sqlAllowed(sql: string, schema: FirehoseSchema): boolean {
  const trimmed = sql.trim();
  if (!/^SELECT\b/i.test(trimmed)) return false;
  if (trimmed.includes(";")) return false;
  if (!/\bLIMIT\s+\d+\s*$/i.test(trimmed)) return false;
  if (/\b(INSERT|ALTER|DROP|CREATE|TRUNCATE|DELETE|UPDATE|GRANT|SYSTEM)\b/i.test(trimmed)) {
    return false;
  }
  const allowed = new Set(schema.tables.map((t) => t.name.toLowerCase()));
  const referenced = [...trimmed.matchAll(/\b(?:FROM|JOIN)\s+([A-Za-z0-9_.]+)/gi)].map((m) =>
    m[1].toLowerCase(),
  );
  if (referenced.length === 0) return false;
  return referenced.every((t) => allowed.has(t));
}

export async function compileQuestion(
  question: string,
  schema: FirehoseSchema,
  propose: Proposer,
): Promise<CompileResult> {
  let reply: string;
  try {
    reply = await propose(buildCompilePrompt(question, schema));
  } catch {
    return { ok: false, reason: "timeout" };
  }
  const text = reply.trim();
  if (/^REFUSE\b/.test(text)) return { ok: false, reason: "refusal" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const result = chartPlanSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reason: "malformed" };

  const plan = result.data as ChartPlan;
  if (!sqlAllowed(plan.sql, schema)) return { ok: false, reason: "disallowed" };
  return { ok: true, plan };
}
