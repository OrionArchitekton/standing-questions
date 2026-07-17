import { NextResponse } from "next/server";
import { ask } from "@/core/ask";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
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
  return NextResponse.json({ ok: true, card: result.card });
}
