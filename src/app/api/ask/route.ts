import { NextResponse } from "next/server";
import { ask } from "@/core/ask";
import { makeRateLimiter } from "@/core/rate-limit";

export const runtime = "nodejs";

const allowAsk = makeRateLimiter({ limit: 10, windowMs: 60_000 });

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!allowAsk(clientIp(req))) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited", message: "Too many questions; wait a minute." },
      { status: 429 },
    );
  }
  let question: unknown;
  try {
    ({ question } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 300) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const result = await ask(question);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true, card: result.card, plan: result.plan });
}
