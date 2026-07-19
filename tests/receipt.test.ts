import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChartPlan } from "../src/core/plan";
import { mintReceipt, verifyReceipt } from "../src/core/receipt";
import type { Snapshot } from "../src/core/types";

const plan: ChartPlan = {
  sql: "SELECT toStartOfHour(ts) AS hour, count() AS posts FROM bluesky_events GROUP BY hour ORDER BY hour LIMIT 24",
  chart: { type: "line", x: "hour", y: "posts", title: "Posts per hour" },
  verdict: { template: "Latest is {stat}" },
  deltaRule: { kind: "threshold", stat: "last", crossesAbove: 100 },
};
const baseline: Snapshot = {
  capturedAt: "2026-07-19T00:00:00.000Z",
  series: [{ t: "2026-07-19 00:00:00", v: 42 }],
  stat: 42,
};
const payload = { question: "How many posts per hour?", plan, baseline };

const priorSecret = process.env.PIN_RECEIPT_SECRET;

describe("pin receipt (server-minted HMAC)", () => {
  beforeAll(() => {
    process.env.PIN_RECEIPT_SECRET = "test-secret-for-receipts";
  });
  afterAll(() => {
    if (priorSecret === undefined) delete process.env.PIN_RECEIPT_SECRET;
    else process.env.PIN_RECEIPT_SECRET = priorSecret;
  });

  it("round-trips: a minted receipt verifies for the same payload", () => {
    const receipt = mintReceipt(payload);
    expect(receipt).toBeTruthy();
    expect(verifyReceipt(payload, receipt as string)).toBe(true);
  });

  it("rejects any tampered field (question, plan sql, baseline stat)", () => {
    const receipt = mintReceipt(payload) as string;
    expect(verifyReceipt({ ...payload, question: "Different question?" }, receipt)).toBe(false);
    expect(
      verifyReceipt(
        { ...payload, plan: { ...plan, sql: "SELECT 1 FROM told_ledger LIMIT 1" } },
        receipt,
      ),
    ).toBe(false);
    expect(
      verifyReceipt({ ...payload, baseline: { ...baseline, stat: 9999 } }, receipt),
    ).toBe(false);
  });

  it("rejects garbage and empty receipts without throwing", () => {
    expect(verifyReceipt(payload, "")).toBe(false);
    expect(verifyReceipt(payload, "zz-not-hex")).toBe(false);
  });
});
