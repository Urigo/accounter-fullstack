export interface ThrottleOptions {
  windowMs: number;
  /** Upper bound on remembered fingerprints, so a flood of distinct alerts cannot grow memory. */
  maxEntries?: number;
  now?: () => number;
}

export interface ThrottleDecision {
  send: boolean;
  /** When `send` is true: how many identical alerts were suppressed in the previous window. */
  suppressed: number;
}

/**
 * In-process dedupe: the first alert with a given fingerprint goes out, repeats within `windowMs`
 * are counted, and the count rides on the next one sent after the window. Good enough for a single
 * instance; N replicas would each send their own first alert.
 *
 * Two steps, so a window opens only for an alert that is really sent: `check` decides, and the
 * caller calls `commit` once the alert is enqueued (not when a later gate, such as the global cap,
 * drops it).
 */
export function createThrottle(options: ThrottleOptions) {
  const { windowMs, maxEntries = 1000, now = Date.now } = options;
  const entries = new Map<string, { windowStart: number; suppressed: number }>();

  function prune(at: number): void {
    for (const [key, entry] of entries) {
      if (at - entry.windowStart >= windowMs) {
        entries.delete(key);
      }
    }
    // Still full of live windows: forget the oldest (Map keeps insertion order).
    for (const key of entries.keys()) {
      if (entries.size <= maxEntries) {
        break;
      }
      entries.delete(key);
    }
  }

  return {
    /** Whether to send. Changes nothing on the send path; counts the repeat on the suppress path. */
    check(fingerprint: string): ThrottleDecision {
      const entry = entries.get(fingerprint);
      if (entry && now() - entry.windowStart < windowMs) {
        entry.suppressed++;
        return { send: false, suppressed: entry.suppressed };
      }
      return { send: true, suppressed: entry?.suppressed ?? 0 };
    },
    /** Opens a new window for a fingerprint that was just sent (and resets its count). */
    commit(fingerprint: string): void {
      const at = now();
      entries.delete(fingerprint);
      entries.set(fingerprint, { windowStart: at, suppressed: 0 });
      if (entries.size > maxEntries) {
        prune(at);
      }
    },
    get size(): number {
      return entries.size;
    },
  };
}
