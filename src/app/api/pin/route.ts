import { NextResponse } from "next/server";
import { z } from "zod";
import { sqlAllowed } from "@/core/compile";
import { listActiveStandingQuestions, pinStandingQuestion } from "@/core/db";
import { firehoseSchema } from "@/core/firehose-schema";
import { chartPlanSchema } from "@/core/plan";
import type { ChartPlan } from "@/core/plan";
import { makeRateLimiter } from "@/core/rate-limit";
import { verifyReceipt } from "@/core/receipt";

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
  chatId: z.string().min(8).max(64).optional(),
  receipt: z.string().min(16).max(128),
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
  // The payload arrives from the client. Two independent checks, both
  // fail-closed: the receipt proves this exact {question, plan, baseline} was
  // minted by our server (no fabricated pins), and the SQL gate re-validates
  // the plan even so (no grandfathered SQL reaches the cron).
  if (
    !verifyReceipt(
      {
        question: parsed.data.question,
        plan: parsed.data.plan as ChartPlan,
        baseline: parsed.data.baseline,
      },
      parsed.data.receipt,
    )
  ) {
    return NextResponse.json(
      { ok: false, reason: "unverified", message: "This answer was not minted by the server." },
      { status: 403 },
    );
  }
  if (!sqlAllowed(parsed.data.plan.sql, firehoseSchema)) {
    return NextResponse.json(
      { ok: false, reason: "disallowed", message: "The plan failed the safety gate." },
      { status: 400 },
    );
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
      parsed.data.chatId ?? null,
    );
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "unreachable", message: "Could not save the standing question." },
      { status: 502 },
    );
  }
}
