import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '../logger.js';

describe('log', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes a single-line JSON entry to console.log for non-error levels', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'hello', { a: 1 });
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({ level: 'info', message: 'hello', a: 1 });
    expect(typeof entry.timestamp).toBe('string');
  });

  it('routes error level to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    log('error', 'boom');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not throw on non-serializable fields, emitting a safe fallback', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => log('info', 'with circular', { circular })).not.toThrow();
    const fallback = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(fallback.message).toBe('failed to serialize log entry');
    expect(fallback.originalMessage).toBe('with circular');
  });
});
