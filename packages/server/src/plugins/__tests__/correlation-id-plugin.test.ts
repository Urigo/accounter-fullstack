import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Span, trace } from '@opentelemetry/api';
import {
  CORRELATION_ID_ATTRIBUTE,
  CORRELATION_ID_HEADER,
  correlationIdOf,
  correlationIdPlugin,
  REQUEST_ID_HEADER,
  requestIdOf,
} from '../correlation-id-plugin.js';

/** Minimal `onRequest` payload with only the header lookup the plugin uses. */
function onRequestArg(headerValue: string | null) {
  return {
    request: {
      headers: { get: (name: string) => (name === CORRELATION_ID_HEADER ? headerValue : null) },
    },
  } as unknown as Parameters<NonNullable<ReturnType<typeof correlationIdPlugin>['onRequest']>>[0];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('correlationIdPlugin', () => {
  it('sets the correlation id as an attribute on the active span', () => {
    const setAttribute = vi.fn();
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue({ setAttribute } as unknown as Span);

    const plugin = correlationIdPlugin();
    plugin.onRequest?.(onRequestArg('corr-123'));

    expect(setAttribute).toHaveBeenCalledWith(CORRELATION_ID_ATTRIBUTE, 'corr-123');
  });

  it('trims the header value', () => {
    const setAttribute = vi.fn();
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue({ setAttribute } as unknown as Span);

    correlationIdPlugin().onRequest?.(onRequestArg('  corr-abc  '));

    expect(setAttribute).toHaveBeenCalledWith(CORRELATION_ID_ATTRIBUTE, 'corr-abc');
  });

  it('is a no-op when the header is absent', () => {
    const getActiveSpan = vi.spyOn(trace, 'getActiveSpan');

    correlationIdPlugin().onRequest?.(onRequestArg(null));

    // Returns before ever touching the tracer when there is nothing to record.
    expect(getActiveSpan).not.toHaveBeenCalled();
  });

  it('is a no-op when the header is blank', () => {
    const getActiveSpan = vi.spyOn(trace, 'getActiveSpan');

    correlationIdPlugin().onRequest?.(onRequestArg('   '));

    expect(getActiveSpan).not.toHaveBeenCalled();
  });

  it('ignores a malformed correlation id', () => {
    const getActiveSpan = vi.spyOn(trace, 'getActiveSpan');

    correlationIdPlugin().onRequest?.(onRequestArg('corr id with spaces'));

    expect(getActiveSpan).not.toHaveBeenCalled();
  });

  it('does not throw when there is no active span (OTEL disabled)', () => {
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined);

    expect(() => correlationIdPlugin().onRequest?.(onRequestArg('corr-1'))).not.toThrow();
  });
});

describe('requestIdOf', () => {
  const request = (headers: Record<string, string>) =>
    new Request('http://localhost/graphql', { headers });

  it('takes a valid X-Request-Id', () => {
    expect(requestIdOf(request({ [REQUEST_ID_HEADER]: ' req-0001 ' }))).toBe('req-0001');
  });

  it('never uses the correlation id, which spans several requests', () => {
    const first = request({ [CORRELATION_ID_HEADER]: 'corr-0001' });
    const retry = request({ [CORRELATION_ID_HEADER]: 'corr-0001' });

    expect(requestIdOf(first)).not.toBe('corr-0001');
    expect(requestIdOf(first)).not.toBe(requestIdOf(retry));
    expect(correlationIdOf(first)).toBe('corr-0001');
  });

  it.each([
    ['too short', 'req-1'],
    ['too long', 'x'.repeat(65)],
    ['spaces', 'req id 0001'],
    ['other characters', 'req/0001"}'],
  ])('mints its own id instead of a header that is %s', (_label, value) => {
    const id = requestIdOf(request({ [REQUEST_ID_HEADER]: value }));

    expect(id).not.toBe(value);
    expect(id).toMatch(/^[A-Za-z0-9._:-]{8,64}$/);
    expect(correlationIdOf(request({ [CORRELATION_ID_HEADER]: value }))).toBeNull();
  });

  it('returns the same id for the same request, even a random one', () => {
    const req = request({});

    expect(requestIdOf(req)).toBe(requestIdOf(req));
  });
});
