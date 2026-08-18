import type { McpErrorCode } from '../errors/taxonomy.js';

/**
 * In-memory operational metrics (spec §11.2).
 *
 * Counters and a latency histogram, aggregated per process. `snapshot()`
 * renders a plain object for a `/metrics` endpoint or tests. Labels never carry
 * PII — only tool names, outcome classes, and error categories.
 */

/** Outcome class recorded per tool request. */
export type RequestOutcome =
  | 'success'
  | 'validation_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'rate_limited'
  | 'upstream_error'
  | 'timeout_error'
  | 'internal_error';

/** Map an error taxonomy code to its request-outcome label. */
export function outcomeForCode(code: McpErrorCode): RequestOutcome {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 'validation_error';
    case 'AUTHENTICATION_ERROR':
      return 'authentication_error';
    case 'AUTHORIZATION_ERROR':
      return 'authorization_error';
    case 'RATE_LIMIT_ERROR':
      return 'rate_limited';
    case 'UPSTREAM_ERROR':
      return 'upstream_error';
    case 'TIMEOUT_ERROR':
      return 'timeout_error';
    case 'INTERNAL_ERROR':
      return 'internal_error';
  }
}

/** Upper bounds (ms) for the latency histogram buckets. */
export const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

/**
 * Maximum distinct labels retained per labeled counter.
 *
 * Labeled counters carry values derived from tool input (e.g. a glossary term a
 * caller asked for that does not exist), so their cardinality is bounded by the
 * caller, not by us. Past this many labels, further *new* labels are folded into
 * {@link OVERFLOW_LABEL} — labels already being tracked keep counting normally.
 */
export const MAX_COUNTER_LABELS = 200;

/** Bucket that absorbs new labels once a counter reaches {@link MAX_COUNTER_LABELS}. */
export const OVERFLOW_LABEL = '__other__';

interface Histogram {
  /**
   * Per-bucket counts (non-cumulative): each entry counts observations that
   * fell into that single bucket, plus a final `+Inf` overflow bucket. The
   * running total is tracked separately in `count`.
   */
  buckets: number[];
  count: number;
  sum: number;
}

export interface MetricsSnapshot {
  /** `mcp_requests_total` keyed by `"<tool>|<outcome>"`. */
  requestsTotal: Record<string, number>;
  /** `auth_failures_total` keyed by reason. */
  authFailuresTotal: Record<string, number>;
  /** `upstream_graphql_errors_total` keyed by category. */
  upstreamErrorsTotal: Record<string, number>;
  /** `rate_limited_total`. */
  rateLimitedTotal: number;
  /** `mcp_request_latency_ms` histogram. */
  latencyMs: { count: number; sum: number; buckets: Record<string, number> };
  /** Tool-contributed label counters, keyed by counter name then label. */
  labeledTotals: Record<string, Record<string, number>>;
}

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export class Metrics {
  private readonly requests = new Map<string, number>();
  private readonly authFailures = new Map<string, number>();
  private readonly upstreamErrors = new Map<string, number>();
  private readonly labeled = new Map<string, Map<string, number>>();
  private rateLimited = 0;
  private readonly latency: Histogram = {
    buckets: new Array(LATENCY_BUCKETS_MS.length + 1).fill(0),
    count: 0,
    sum: 0,
  };

  /** Record a finished tool request with its outcome and latency. */
  recordRequest(tool: string, outcome: RequestOutcome, latencyMs: number): void {
    inc(this.requests, `${tool}|${outcome}`);
    this.observeLatency(latencyMs);
  }

  observeLatency(ms: number): void {
    this.latency.count += 1;
    this.latency.sum += ms;
    let placed = false;
    for (let i = 0; i < LATENCY_BUCKETS_MS.length; i += 1) {
      if (ms <= LATENCY_BUCKETS_MS[i]) {
        this.latency.buckets[i] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) {
      this.latency.buckets[LATENCY_BUCKETS_MS.length] += 1; // +Inf
    }
  }

  recordAuthFailure(reason: string): void {
    inc(this.authFailures, reason);
  }

  recordUpstreamError(category: string): void {
    inc(this.upstreamErrors, category);
  }

  recordRateLimited(): void {
    this.rateLimited += 1;
  }

  /**
   * Increment a labeled counter contributed by a tool's `observe` hook.
   *
   * Bounded on purpose: an unknown label arriving at a counter that already
   * holds {@link MAX_COUNTER_LABELS} labels is counted under
   * {@link OVERFLOW_LABEL} instead of adding a new key, so caller-derived labels
   * cannot grow this map without limit. Known labels always increment, so the
   * top-N that matters stays accurate once the cap is reached.
   */
  recordLabeled(counter: string, label: string): void {
    let labels = this.labeled.get(counter);
    if (!labels) {
      labels = new Map<string, number>();
      this.labeled.set(counter, labels);
    }
    const key = labels.has(label) || labels.size < MAX_COUNTER_LABELS ? label : OVERFLOW_LABEL;
    inc(labels, key);
  }

  snapshot(): MetricsSnapshot {
    const bucketLabels: Record<string, number> = {};
    for (const [i, bound] of LATENCY_BUCKETS_MS.entries()) {
      bucketLabels[String(bound)] = this.latency.buckets[i];
    }
    bucketLabels['+Inf'] = this.latency.buckets[LATENCY_BUCKETS_MS.length];
    const labeledTotals: Record<string, Record<string, number>> = {};
    for (const [counter, labels] of this.labeled) {
      labeledTotals[counter] = Object.fromEntries(labels);
    }
    return {
      requestsTotal: Object.fromEntries(this.requests),
      authFailuresTotal: Object.fromEntries(this.authFailures),
      upstreamErrorsTotal: Object.fromEntries(this.upstreamErrors),
      rateLimitedTotal: this.rateLimited,
      latencyMs: { count: this.latency.count, sum: this.latency.sum, buckets: bucketLabels },
      labeledTotals,
    };
  }

  reset(): void {
    this.requests.clear();
    this.authFailures.clear();
    this.upstreamErrors.clear();
    this.labeled.clear();
    this.rateLimited = 0;
    this.latency.buckets.fill(0);
    this.latency.count = 0;
    this.latency.sum = 0;
  }
}

let processMetrics: Metrics | undefined;

/** The process-wide metrics registry (no env dependency). */
export function getMetrics(): Metrics {
  processMetrics ??= new Metrics();
  return processMetrics;
}

/** Test-only: reset the process metrics registry. */
export function resetMetrics(): void {
  getMetrics().reset();
}
