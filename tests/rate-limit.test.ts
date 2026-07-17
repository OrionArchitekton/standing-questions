import { describe, expect, it } from "vitest";
import { makeRateLimiter } from "../src/core/rate-limit";

describe("makeRateLimiter (per-IP fixed window)", () => {
  it("allows up to the limit within a window, then rejects", () => {
    const allow = makeRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(allow("1.2.3.4", 0)).toBe(true);
    expect(allow("1.2.3.4", 1_000)).toBe(true);
    expect(allow("1.2.3.4", 2_000)).toBe(true);
    expect(allow("1.2.3.4", 3_000)).toBe(false);
  });

  it("tracks IPs independently", () => {
    const allow = makeRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("b", 0)).toBe(true);
    expect(allow("a", 1)).toBe(false);
  });

  it("resets after the window slides past old requests", () => {
    const allow = makeRateLimiter({ limit: 2, windowMs: 10_000 });
    expect(allow("x", 0)).toBe(true);
    expect(allow("x", 1_000)).toBe(true);
    expect(allow("x", 2_000)).toBe(false);
    expect(allow("x", 11_500)).toBe(true); // first two aged out
  });

  it("caps tracked IPs to bound memory (evicts oldest)", () => {
    const allow = makeRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    allow("k1", 0);
    allow("k2", 1);
    allow("k3", 2); // evicts k1
    expect(allow("k1", 3)).toBe(true); // k1 re-admitted fresh
  });
});
