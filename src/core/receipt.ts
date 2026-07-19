import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChartPlan } from "./plan";
import type { Snapshot } from "./types";

export type PinPayload = {
  question: string;
  plan: ChartPlan;
  baseline: Snapshot;
};

function secret(): string | null {
  return process.env.PIN_RECEIPT_SECRET ?? process.env.TRIGGER_SECRET_KEY ?? null;
}

function canonical(payload: PinPayload): string {
  // The exact objects the server answered with round-trip through JSON to the
  // client and back, so insertion order is stable end to end.
  return JSON.stringify({
    question: payload.question,
    plan: payload.plan,
    baseline: payload.baseline,
  });
}

/**
 * Sign an answer the server actually produced so /api/pin can verify the pin
 * payload is untampered. Returns null when no signing secret is configured
 * (local tests without env); the pin route then refuses pins (fail closed).
 */
export function mintReceipt(payload: PinPayload): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(canonical(payload)).digest("hex");
}

/** Constant-time verification of a client-returned receipt. */
export function verifyReceipt(payload: PinPayload, receipt: string): boolean {
  const expected = mintReceipt(payload);
  if (!expected) return false;
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(receipt, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
