import { type Span, SpanStatusCode, type Tracer, trace } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORRELATION_ID_ATTRIBUTE, withSpan } from '../tracing.js';

function fakeSpan() {
  return {
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    recordException: vi.fn(),
    end: vi.fn(),
  };
}

/** Stub `trace.getTracer` with a tracer whose active span is `span`. */
function stubTracer(span: ReturnType<typeof fakeSpan>) {
  const tracer = {
    startActiveSpan: (_name: string, fn: (s: Span) => unknown) => fn(span as unknown as Span),
  } as unknown as Tracer;
  return vi.spyOn(trace, 'getTracer').mockReturnValue(tracer);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withSpan', () => {
  it('returns the wrapped function result', async () => {
    stubTracer(fakeSpan());
    await expect(withSpan('work', 'corr-1', async () => 42)).resolves.toBe(42);
  });

  it('sets the correlation-id attribute, marks the span OK, and ends it', async () => {
    const span = fakeSpan();
    stubTracer(span);

    await withSpan('tool:search', 'corr-1', async () => 'ok');

    expect(span.setAttribute).toHaveBeenCalledWith(CORRELATION_ID_ATTRIBUTE, 'corr-1');
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
    expect(span.recordException).not.toHaveBeenCalled();
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('records the exception, marks the span errored, ends it, and re-throws', async () => {
    const span = fakeSpan();
    stubTracer(span);
    const boom = new TypeError('nope');

    await expect(
      withSpan('auth:verify', 'corr-2', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    expect(span.setAttribute).toHaveBeenCalledWith(CORRELATION_ID_ATTRIBUTE, 'corr-2');
    expect(span.recordException).toHaveBeenCalledWith(boom);
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'TypeError',
    });
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('omits the correlation attribute when no correlation id is given', async () => {
    const span = fakeSpan();
    stubTracer(span);

    await withSpan('work', '', async () => undefined);

    expect(span.setAttribute).not.toHaveBeenCalled();
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('works with the global no-op tracer (OTEL disabled) — result and re-throw preserved', async () => {
    // No stub: with no registered provider, the API returns a no-op tracer, so
    // withSpan must still run the work and propagate results/errors unchanged.
    await expect(withSpan('work', 'corr', async () => 'value')).resolves.toBe('value');
    const boom = new Error('boom');
    await expect(
      withSpan('work', 'corr', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
