// In-process, in-memory fixed-window counters keyed by company slug ONLY. This is a per-company
// ceiling, not per-visitor: the intake deliberately reads no client address (CLAUDE.md §8), so
// per-IP limiting is a Cloudflare rule added in phase 9. Counters reset on restart and are not
// shared between processes (there is one: systemd runs a single Node server).

export type Limiter = { hit(key: string, now?: number): boolean };

export function createLimiter(max: number, windowMs: number): Limiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    /** true = allowed. */
    hit(key, now = Date.now()) {
      if (windows.size > 5000)
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      const w = windows.get(key);
      if (!w || w.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      w.count += 1;
      return w.count <= max;
    },
  };
}

/** Status lookups: 10 per minute per company. Submissions: 20 per hour per company. */
export const statusLimiter = createLimiter(10, 60_000);
export const submitLimiter = createLimiter(20, 3_600_000);
