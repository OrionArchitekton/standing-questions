export type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  maxKeys?: number;
};

/**
 * Per-key sliding-window limiter. In-memory and per-instance: on serverless
 * this bounds abuse per warm instance rather than globally, which is the
 * honest trade-off for a keyless public demo (documented in the README).
 */
export function makeRateLimiter(opts: RateLimiterOptions): (key: string, now?: number) => boolean {
  const { limit, windowMs, maxKeys = 5_000 } = opts;
  const hits = new Map<string, number[]>();

  return (key: string, now: number = Date.now()): boolean => {
    const cutoff = now - windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    if (!hits.has(key) && hits.size >= maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest !== undefined) hits.delete(oldest);
    }
    hits.set(key, recent);
    return true;
  };
}
