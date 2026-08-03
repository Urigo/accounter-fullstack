import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Span, trace } from '@opentelemetry/api';
import {
  CORRELATION_ID_ATTRIBUTE,
  CORRELATION_ID_HEADER,
  correlationIdPlugin,
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

  it('does not throw when there is no active span (OTEL disabled)', () => {
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined);

    expect(() => correlationIdPlugin().onRequest?.(onRequestArg('corr-1'))).not.toThrow();
  });
});
