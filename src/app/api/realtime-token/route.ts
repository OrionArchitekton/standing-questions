import { auth } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Mints a read-only Realtime token scoped to runs tagged "sq" (the standing
 * re-eval sweeps). When TRIGGER_SECRET_KEY is absent or minting fails, the UI
 * falls back to timed refresh; the page never breaks.
 */
export async function GET(): Promise<NextResponse> {
  if (!process.env.TRIGGER_SECRET_KEY) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  try {
    const token = await auth.createPublicToken({
      scopes: { read: { tags: ["sq"] } },
      expirationTime: "1h",
    });
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
