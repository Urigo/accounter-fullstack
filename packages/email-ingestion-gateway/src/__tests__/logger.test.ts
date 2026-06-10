import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCorrelationId, log } from '../logger.js';

describe('generateCorrelationId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCorrelationId()).toBe('string');
    expect(generateCorrelationId().length).toBeGreaterThan(0);
  });

  it('returns a different value on each call', () => {
    expect(generateCorrelationId()).not.toBe(generateCorrelationId());
  });

  it('returns a UUID v4 format string', () => {
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(generateCorrelationId()).toMatch(uuidV4Regex);
  });
});

describe('log', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('writes info entries to console.log as JSON', () => {
    log('info', 'test message');
    expect(logSpy).toHaveBeenCalledOnce();
    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('test message');
    expect(typeof entry.timestamp).toBe('string');
  });

  it('writes warn entries to console.log as JSON', () => {
    log('warn', 'warning message');
    expect(logSpy).toHaveBeenCalledOnce();
    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(entry.level).toBe('warn');
  });

  it('writes error entries to console.error as JSON', () => {
    log('error', 'error message');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
    const entry = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('error message');
  });

  it('includes correlationId when provided', () => {
    log('info', 'msg', undefined, 'corr-123');
    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(entry.correlationId).toBe('corr-123');
  });

  it('omits correlationId when not provided', () => {
    log('info', 'msg');
    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(entry).not.toHaveProperty('correlationId');
  });

  it('merges extra fields into the log entry', () => {
    log('info', 'msg', { method: 'GET', path: '/health' });
    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/health');
  });

  it('timestamp is a valid ISO string', () => {
    log('info', 'msg');
    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(() => new Date(entry.timestamp as string).toISOString()).not.toThrow();
  });
});
