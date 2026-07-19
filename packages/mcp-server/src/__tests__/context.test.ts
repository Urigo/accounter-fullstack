import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  createRequestContext,
  elapsedMs,
  getRequestContext,
  setRequestContext,
} from '../context.js';

function req(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return { headers: {}, method: 'GET', url: '/health', ...overrides } as unknown as IncomingMessage;
}

describe('createRequestContext', () => {
  it('mints a request id and a correlation id', () => {
    const ctx = createRequestContext(req());
    expect(ctx.requestId).toMatch(/[0-9a-f-]{36}/);
    expect(ctx.correlationId).toMatch(/[0-9a-f-]{36}/);
    expect(ctx.requestId).not.toBe(ctx.correlationId);
  });

  it('inherits the correlation id from the inbound header', () => {
    const ctx = createRequestContext(req({ headers: { 'x-correlation-id': 'trace-abc' } }));
    expect(ctx.correlationId).toBe('trace-abc');
  });

  it('captures method and route without the query string', () => {
    const ctx = createRequestContext(req({ method: 'POST', url: '/mcp?token=secret' }));
    expect(ctx.method).toBe('POST');
    expect(ctx.route).toBe('/mcp');
  });

  it('measures elapsed time as a non-negative integer', () => {
    const ctx = createRequestContext(req());
    expect(elapsedMs(ctx)).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(elapsedMs(ctx))).toBe(true);
  });
});

describe('request context store', () => {
  it('associates and retrieves a context per request', () => {
    const request = req();
    const ctx = createRequestContext(request);
    setRequestContext(request, ctx);
    expect(getRequestContext(request)).toBe(ctx);
  });

  it('returns undefined for a request with no stored context', () => {
    expect(getRequestContext(req())).toBeUndefined();
  });
});
