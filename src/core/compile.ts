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
    "Rules for deltaRule: regime minRatio must be greater than 1 (e.g. 1.5 fires when the recent mean rises 50 percent above the baseline mean).",
    "Rules for text fields: title at most 60 characters; verdict template one line using {stat}; never use em or en dashes in any text field.",
    "If the question cannot be answered from these tables, reply exactly: REFUSE: <ten words why>.",
    "",
    `Question: ${question}`,
  ].join("\n");
}

/** Largest LIMIT the gate accepts; matches the 2000-point snapshot cap at pin time. */
export const MAX_LIMIT = 2000;

/**
 * A comma at paren depth 0 inside a FROM clause is an implicit cross join:
 * `FROM a, b` (or `FROM a, url(...)`) smuggles a second source past the
 * FROM/JOIN table extraction below. Commas inside function calls
 * (`uniq(did, kind)`) sit at depth > 0 and stay legal.
 */
function fromClauseHasTopLevelComma(stripped: string): boolean {
  const fromRe = /\bFROM\b/gi;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(stripped)) !== null) {
    let depth = 0;
    for (let i = m.index + m[0].length; i < stripped.length; i++) {
      const ch = stripped[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        if (depth === 0) break; // closing a paren the FROM lives inside
        depth--;
      } else if (ch === "," && depth === 0) return true;
      else if (
        depth === 0 &&
        /\b(WHERE|GROUP|ORDER|HAVING|LIMIT|UNION|SETTINGS)\b/i.test(stripped.slice(i, i + 9))
      ) {
        break;
      }
    }
  }
  return false;
}

/**
 * The fail-closed SQL gate. Exported so every path that can carry a plan to
 * ClickHouse re-validates it: compile (here), /api/pin (client-supplied plans),
 * and the re-eval cron (defense in depth for rows already in Postgres).
 */
export function sqlAllowed(sql: string, schema: FirehoseSchema): boolean {
  const trimmed = sql.trim();
  const stripped = trimmed.replace(/'(?:[^']|'')*'/g, "''");
  if (!/^SELECT\b/i.test(stripped)) return false;
  if (stripped.includes(";")) return false;
  const limitMatch = stripped.match(/\bLIMIT\s+(\d+)\s*$/i);
  if (!limitMatch || Number(limitMatch[1]) > MAX_LIMIT) return false;
  if (/\b(INSERT|ALTER|DROP|CREATE|TRUNCATE|DELETE|UPDATE|GRANT|SYSTEM)\b/i.test(stripped)) {
    return false;
  }
  if (fromClauseHasTopLevelComma(stripped)) return false;
  const allowed = new Set(schema.tables.map((t) => t.name.toLowerCase()));
  const referenced = [...stripped.matchAll(/\b(?:FROM|JOIN)\s+([A-Za-z0-9_.]+)/gi)].map((m) =>
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
