import { z } from "zod";
import type { DeltaRule } from "./types";

export type FirehoseSchema = {
  tables: {
    name: string;
    columns: string[];
    description: string;
  }[];
};

const deltaRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("threshold"),
    stat: z.literal("last"),
    crossesAbove: z.number().optional(),
    crossesBelow: z.number().optional(),
  }),
  z.object({
    kind: z.literal("regime"),
    window: z.number().int().positive(),
    // > 1 or the rule fires on an ordinary evaluation: regimeFired tests
    // next/baseline >= minRatio, so 0.5 would trigger on almost any tick.
    minRatio: z.number().gt(1),
  }),
]);

export const chartPlanSchema = z.object({
  sql: z.string().min(1),
  chart: z.object({
    type: z.enum(["line", "bar", "area"]),
    x: z.string().min(1),
    y: z.string().min(1),
    title: z.string().min(1).max(60),
  }),
  verdict: z.object({
    template: z.string().min(1).max(120),
  }),
  deltaRule: deltaRuleSchema,
});

export type ChartPlan = Omit<z.infer<typeof chartPlanSchema>, "deltaRule"> & {
  deltaRule: DeltaRule;
};

export type CompileFailure = {
  ok: false;
  reason: "refusal" | "malformed" | "disallowed" | "timeout";
};

export type CompileResult = { ok: true; plan: ChartPlan } | CompileFailure;
