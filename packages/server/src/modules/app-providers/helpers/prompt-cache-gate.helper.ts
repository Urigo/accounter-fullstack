import { createHash } from 'node:crypto';

/**
 * Coordinates concurrent requests that share one cached prompt prefix.
 *
 * Anthropic's prompt cache is a prefix match, and an entry does not become
 * readable until the request that writes it responds. N requests carrying the
 * same prefix issued at once therefore all miss and all write their own copy,
 * paying the write premium N times instead of once.
 *
 * Production ingest logs show why that matters here: documents do not arrive at
 * a steady rate, they arrive in bursts — a median of ~1.4s between consecutive
 * emails inside a burst, against gaps of several hours between bursts. Almost
 * every document therefore lands while a sibling request for the same tenant is
 * still in flight, and the cache only ever amortizes within a burst.
 *
 * So the first caller on a cold prefix runs alone while the others wait for it,
 * and once the prefix is known warm nobody waits at all. Both mistakes this can
 * make are cheap: a wrong "warm" costs one cache write, a wrong "cold" costs one
 * serialized round trip.
 *
 * Keyed on the rendered prefix rather than on the tenant, which is what Anthropic
 * itself keys on. That matters because one tenant can legitimately produce two
 * different catalogs — the email path and the interactive upload path load
 * businesses through different queries — and a tenant-keyed gate would report a
 * warm entry that the other path can never read.
 */

export type CacheGateOutcome =
  /** The prefix was already known warm; issued immediately, in parallel. */
  | 'warm'
  /** This call warmed a cold prefix while others waited on it. */
  | 'warmed'
  /** Waited for another call to warm the prefix, then issued as a reader. */
  | 'waited'
  /** The prefix is below the model's minimum cacheable length; never gated. */
  | 'uncacheable';

type PrefixState = {
  /** Epoch ms until which the entry is believed readable. */
  warmUntil: number;
  /** Resolves when the call currently warming this prefix has responded. */
  inFlight: Promise<void> | null;
  /** Set once a write produced no cache activity — the prefix is too short. */
  uncacheable: boolean;
  /** Epoch ms of the last touch, for pruning only. */
  lastUsed: number;
};

export type PromptCacheGateOptions = {
  /** Must match the `ttl` on the request's `cacheControl` breakpoint. */
  ttlMs: number;
  /**
   * Ceiling on how long a caller waits for the warming call. Keep it comfortably
   * inside any request deadline upstream: on expiry every waiter proceeds and
   * pays a write, which is degraded but never stalled.
   */
  maxWaitMs: number;
  /**
   * Subtracted from the TTL when recording warmth. Anthropic measures an entry's
   * lifetime from the *start* of the request that writes or reads it, so
   * generation time counts against it.
   */
  safetyMarginMs: number;
  /** Prune threshold. Entries are keyed by prefix, so this bounds catalog churn. */
  maxEntries?: number;
  /** Injectable clock, for tests. */
  now?: () => number;
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Resolve when `promise` settles or `ms` elapses, whichever comes first — and
 * never keep the event loop alive for the timer, nor reject if the warming call
 * threw (a failed warm is still the signal to stop waiting).
 */
function settleOrTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    promise.then(done, done);
  });
}

export class PromptCacheGate {
  private readonly states = new Map<string, PrefixState>();
  private readonly ttlMs: number;
  private readonly maxWaitMs: number;
  private readonly safetyMarginMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: PromptCacheGateOptions) {
    this.ttlMs = options.ttlMs;
    this.maxWaitMs = options.maxWaitMs;
    this.safetyMarginMs = options.safetyMarginMs;
    this.maxEntries = options.maxEntries ?? 100;
    this.now = options.now ?? Date.now;
  }

  /**
   * Run `call` under the gate for `prefix`.
   *
   * `observedCacheActivity` reads the provider's usage counters off the result and
   * reports whether the request wrote or read a cache entry — warmth is recorded
   * from what actually happened, never from an assumption that it did.
   */
  async run<T>(
    prefix: string,
    call: () => Promise<T>,
    observedCacheActivity: (result: T) => boolean,
  ): Promise<{ result: T; gate: CacheGateOutcome }> {
    const key = createHash('sha256').update(prefix).digest('hex');

    // Everything from here to the `inFlight` assignment must stay synchronous.
    // An `await` in the middle lets two callers in the same tick both find no
    // warmer and both elect themselves, which is the exact race being closed.
    const state = this.states.get(key);
    const now = this.now();
    let gate: CacheGateOutcome;
    let waitFor: Promise<void> | null = null;
    let release: (() => void) | null = null;

    if (state?.uncacheable) {
      gate = 'uncacheable';
    } else if (state && state.warmUntil > now) {
      gate = 'warm';
    } else if (state?.inFlight) {
      gate = 'waited';
      waitFor = state.inFlight;
    } else {
      gate = 'warmed';
      const gateLock = deferred();
      this.touch(key, now).inFlight = gateLock.promise;
      release = gateLock.resolve;
    }

    if (waitFor) {
      await settleOrTimeout(waitFor, this.maxWaitMs);
    }

    const startedAt = this.now();
    try {
      const result = await call();
      const entry = this.touch(key, this.now());
      if (observedCacheActivity(result)) {
        entry.warmUntil = startedAt + this.ttlMs - this.safetyMarginMs;
      } else if (gate === 'warmed') {
        // We held the lock and still cached nothing, so this prefix is below the
        // model's minimum cacheable length. That is a property of these exact
        // bytes, and a different catalog hashes to a different key — so stop
        // gating this one rather than serializing a batch for a cache that will
        // never exist.
        entry.uncacheable = true;
        entry.warmUntil = 0;
      }
      return { result, gate };
    } finally {
      if (release) {
        const entry = this.states.get(key);
        if (entry) {
          entry.inFlight = null;
        }
        // In a `finally` so a thrown call can never leave the gate shut.
        release();
      }
      this.prune();
    }
  }

  private touch(key: string, now: number): PrefixState {
    const existing = this.states.get(key);
    if (existing) {
      existing.lastUsed = now;
      return existing;
    }
    const created: PrefixState = {
      warmUntil: 0,
      inFlight: null,
      uncacheable: false,
      lastUsed: now,
    };
    this.states.set(key, created);
    return created;
  }

  private prune(): void {
    if (this.states.size <= this.maxEntries) {
      return;
    }
    const cutoff = this.now() - 2 * this.ttlMs;
    for (const [key, state] of this.states) {
      if (state.inFlight === null && state.lastUsed < cutoff) {
        this.states.delete(key);
      }
    }
  }
}
