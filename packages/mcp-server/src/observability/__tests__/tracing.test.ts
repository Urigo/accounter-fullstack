import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger.js';
import { withSpan } from '../tracing.js';

function spyLog() {
  return vi.spyOn(logger, 'log').mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withSpan', () => {
  it('returns the wrapped function result', async () => {
    spyLog();
    await expect(withSpan('work', 'corr-1', async () => 42)).resolves.toBe(42);
  });

  it('emits a start and a successful end span carrying the correlation id', async () => {
    const log = spyLog();
    await withSpan('tool:search', 'corr-1', async () => 'ok');

    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenNthCalledWith(1, 'debug', 'span start', {
      span: 'tool:search',
      correlationId: 'corr-1',
    });
    const [, , endFields] = log.mock.calls[1];
    expect(endFields).toMatchObject({ span: 'tool:search', correlationId: 'corr-1', ok: true });
    expect(typeof (endFields as { durationMs: number }).durationMs).toBe('number');
  });

  it('logs a failed end span and re-throws the error', async () => {
    const log = spyLog();
    const boom = new TypeError('nope');

    await expect(
      withSpan('auth:verify', 'corr-2', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    const [, , endFields] = log.mock.calls[1];
    expect(endFields).toMatchObject({
      span: 'auth:verify',
      correlationId: 'corr-2',
      ok: false,
      error: 'TypeError',
    });
  });
});
