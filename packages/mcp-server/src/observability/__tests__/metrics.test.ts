import { describe, expect, it } from 'vitest';
import type { McpErrorCode } from '../../errors/taxonomy.js';
import {
  getMetrics,
  LATENCY_BUCKETS_MS,
  MAX_COUNTER_LABELS,
  Metrics,
  outcomeForCode,
  OVERFLOW_LABEL,
  resetMetrics,
  type RequestOutcome,
} from '../metrics.js';

describe('outcomeForCode', () => {
  const cases: Array<[McpErrorCode, RequestOutcome]> = [
    ['VALIDATION_ERROR', 'validation_error'],
    ['AUTHENTICATION_ERROR', 'authentication_error'],
    ['AUTHORIZATION_ERROR', 'authorization_error'],
    ['RATE_LIMIT_ERROR', 'rate_limited'],
    ['UPSTREAM_ERROR', 'upstream_error'],
    ['TIMEOUT_ERROR', 'timeout_error'],
    ['INTERNAL_ERROR', 'internal_error'],
  ];

  it.each(cases)('maps %s to %s', (code, outcome) => {
    expect(outcomeForCode(code)).toBe(outcome);
  });
});

describe('Metrics', () => {
  it('counts requests keyed by tool + outcome', () => {
    const metrics = new Metrics();
    metrics.recordRequest('search_charges', 'success', 12);
    metrics.recordRequest('search_charges', 'success', 20);
    metrics.recordRequest('search_charges', 'validation_error', 3);

    const snapshot = metrics.snapshot();
    expect(snapshot.requestsTotal).toEqual({
      'search_charges|success': 2,
      'search_charges|validation_error': 1,
    });
  });

  it('accumulates latency count and sum', () => {
    const metrics = new Metrics();
    metrics.observeLatency(10);
    metrics.observeLatency(30);

    const { latencyMs } = metrics.snapshot();
    expect(latencyMs.count).toBe(2);
    expect(latencyMs.sum).toBe(40);
  });

  it('places latencies into the correct histogram buckets', () => {
    const metrics = new Metrics();
    metrics.observeLatency(3); // <= 5
    metrics.observeLatency(5); // <= 5 (boundary is inclusive)
    metrics.observeLatency(7); // <= 10
    metrics.observeLatency(9999); // +Inf

    const { buckets } = metrics.snapshot().latencyMs;
    expect(buckets['5']).toBe(2);
    expect(buckets['10']).toBe(1);
    expect(buckets['+Inf']).toBe(1);
  });

  it('exposes a bucket label for every configured bound plus +Inf', () => {
    const metrics = new Metrics();
    const { buckets } = metrics.snapshot().latencyMs;
    for (const bound of LATENCY_BUCKETS_MS) {
      expect(buckets).toHaveProperty(String(bound));
    }
    expect(buckets).toHaveProperty('+Inf');
  });

  it('counts auth failures, upstream errors, and rate limits', () => {
    const metrics = new Metrics();
    metrics.recordAuthFailure('missing_token');
    metrics.recordAuthFailure('invalid_token');
    metrics.recordAuthFailure('invalid_token');
    metrics.recordUpstreamError('upstream_error');
    metrics.recordRateLimited();
    metrics.recordRateLimited();

    const snapshot = metrics.snapshot();
    expect(snapshot.authFailuresTotal).toEqual({ missing_token: 1, invalid_token: 2 });
    expect(snapshot.upstreamErrorsTotal).toEqual({ upstream_error: 1 });
    expect(snapshot.rateLimitedTotal).toBe(2);
  });

  it('reset() clears all counters and the histogram', () => {
    const metrics = new Metrics();
    metrics.recordRequest('t', 'success', 10);
    metrics.recordAuthFailure('missing_token');
    metrics.recordUpstreamError('upstream_error');
    metrics.recordRateLimited();

    metrics.reset();

    const snapshot = metrics.snapshot();
    expect(snapshot.requestsTotal).toEqual({});
    expect(snapshot.authFailuresTotal).toEqual({});
    expect(snapshot.upstreamErrorsTotal).toEqual({});
    expect(snapshot.rateLimitedTotal).toBe(0);
    expect(snapshot.latencyMs.count).toBe(0);
    expect(snapshot.latencyMs.sum).toBe(0);
    expect(snapshot.latencyMs.buckets['+Inf']).toBe(0);
    expect(snapshot.labeledTotals).toEqual({});
  });
});

describe('Metrics.recordLabeled', () => {
  it('counts labels per counter, keeping counters independent', () => {
    const metrics = new Metrics();
    metrics.recordLabeled('glossary_term_requests', 'charge');
    metrics.recordLabeled('glossary_term_requests', 'charge');
    metrics.recordLabeled('glossary_term_requests', 'ledger-record');
    metrics.recordLabeled('glossary_mode', 'full');

    expect(metrics.snapshot().labeledTotals).toEqual({
      glossary_term_requests: { charge: 2, 'ledger-record': 1 },
      glossary_mode: { full: 1 },
    });
  });

  it('omits counters that were never touched', () => {
    expect(new Metrics().snapshot().labeledTotals).toEqual({});
  });

  it('folds new labels into the overflow bucket once the cap is reached', () => {
    const metrics = new Metrics();
    for (let i = 0; i < MAX_COUNTER_LABELS; i += 1) {
      metrics.recordLabeled('misses', `term-${i}`);
    }
    metrics.recordLabeled('misses', 'one-too-many');
    metrics.recordLabeled('misses', 'another-one');

    const labels = metrics.snapshot().labeledTotals.misses;
    // Labels are caller-derived, so the map must not grow past the cap (+ the
    // overflow bucket itself) no matter what a caller sends.
    expect(Object.keys(labels)).toHaveLength(MAX_COUNTER_LABELS + 1);
    expect(labels[OVERFLOW_LABEL]).toBe(2);
    expect(labels['one-too-many']).toBeUndefined();
  });

  it('keeps counting labels it already tracks after the cap is reached', () => {
    const metrics = new Metrics();
    for (let i = 0; i < MAX_COUNTER_LABELS; i += 1) {
      metrics.recordLabeled('misses', `term-${i}`);
    }
    metrics.recordLabeled('misses', 'overflowing');
    metrics.recordLabeled('misses', 'term-0');

    // The top-N that matters stays accurate; only unseen labels are collapsed.
    expect(metrics.snapshot().labeledTotals.misses['term-0']).toBe(2);
  });

  it('is cleared by reset', () => {
    const metrics = new Metrics();
    metrics.recordLabeled('misses', 'frobnicator');
    metrics.reset();
    expect(metrics.snapshot().labeledTotals).toEqual({});
  });
});

describe('getMetrics / resetMetrics', () => {
  it('returns a memoized process-wide singleton', () => {
    expect(getMetrics()).toBe(getMetrics());
  });

  it('resetMetrics clears the singleton without replacing it', () => {
    const before = getMetrics();
    before.recordRateLimited();
    resetMetrics();
    expect(getMetrics()).toBe(before);
    expect(getMetrics().snapshot().rateLimitedTotal).toBe(0);
  });
});
