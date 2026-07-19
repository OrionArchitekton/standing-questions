import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { makeRateLimiter } from "@/core/rate-limit";

export const runtime = "nodejs";

const allowSession = makeRateLimiter({ limit: 10, windowMs: 60_000 });

const bodySchema = z.object({
  chatId: z.string().min(8).max(64),
  // "start" creates (or resumes) the session and returns its scoped token;
  // "refresh" mints a fresh session-scoped token after PAT expiry.
  mode: z.enum(["start", "refresh"]).default("start"),
});

const startSession = chat.createStartSessionAction("sq-chat");

export async function POST(req: Request): Promise<NextResponse> {
  if (!process.env.TRIGGER_SECRET_KEY) {
    return NextResponse.json({ ok: false, reason: "unconfigured" }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowSession(ip)) {
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const { chatId, mode } = parsed.data;

  try {
    if (mode === "refresh") {
      const token = await auth.createPublicToken({
        scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
        expirationTime: "1h",
      });
      return NextResponse.json({ ok: true, publicAccessToken: token });
    }
    const result = await startSession({ chatId });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" }, { status: 502 });
  }
}
