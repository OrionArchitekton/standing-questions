import { NextResponse } from "next/server";
import { z } from "zod";
import { listActiveStandingQuestions, pinStandingQuestion } from "@/core/db";
import { chartPlanSchema } from "@/core/plan";
import type { ChartPlan } from "@/core/plan";
import { makeRateLimiter } from "@/core/rate-limit";

export const runtime = "nodejs";

const MAX_ACTIVE_QUESTIONS = 50;
const allowPin = makeRateLimiter({ limit: 5, windowMs: 60_000 });

const snapshotSchema = z.object({
  capturedAt: z.string().min(1),
  series: z.array(z.object({ t: z.string(), v: z.number() })).max(2_000),
  stat: z.number(),
});

const pinBodySchema = z.object({
  question: z.string().min(3).max(300),
  plan: chartPlanSchema,
  baseline: snapshotSchema,
});

export async function POST(req: Request): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowPin(ip)) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited", message: "Too many pins; wait a minute." },
      { status: 429 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const parsed = pinBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  try {
    const active = await listActiveStandingQuestions();
    if (active.length >= MAX_ACTIVE_QUESTIONS) {
      return NextResponse.json(
        { ok: false, reason: "capacity", message: "Demo pin capacity reached." },
        { status: 429 },
      );
    }
    const { id } = await pinStandingQuestion(
      parsed.data.question,
      parsed.data.plan as ChartPlan,
      parsed.data.baseline,
    );
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "unreachable", message: "Could not save the standing question." },
      { status: 502 },
    );
  }
}
