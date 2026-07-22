import { log } from '../logger.js';

/**
 * Minimal tracing spans (spec §11.3).
 *
 * Wraps a unit of work (auth validation, an upstream call, tool execution) and
 * emits structured start/end debug logs carrying the correlation id and the
 * span duration. Deliberately lightweight — no external tracer dependency — so
 * it can be swapped for OpenTelemetry later without touching call sites.
 */
export async function withSpan<T>(
  name: string,
  correlationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  log('debug', 'span start', { span: name, correlationId });
  try {
    const result = await fn();
    log('debug', 'span end', {
      span: name,
      correlationId,
      durationMs: Math.round(performance.now() - start),
      ok: true,
    });
    return result;
  } catch (error) {
    log('debug', 'span end', {
      span: name,
      correlationId,
      durationMs: Math.round(performance.now() - start),
      ok: false,
      error: error instanceof Error ? error.name : 'unknown',
    });
    throw error;
  }
}
