import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  createYogaLogger,
  log,
  markLogged,
  serializeError,
  setLogContextProvider,
  setLogLevel,
  setLogWriter,
} from '../log.js';

let stdout: MockInstance;
let stderr: MockInstance;

beforeEach(() => {
  stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
});

afterEach(() => {
  setLogLevel('info');
  setLogContextProvider();
  setLogWriter();
  vi.restoreAllMocks();
});

const lines = (spy: MockInstance) => spy.mock.calls.map(([chunk]) => String(chunk));
const records = () => lines(stdout).map(line => JSON.parse(line) as Record<string, unknown>);

describe('log', () => {
  it('writes one JSON line per record, every level to stdout', () => {
    log('info', 'thing-happened', { count: 2 });
    log('error', 'thing-failed', { id: 'x' });

    expect(lines(stderr)).toEqual([]);
    expect(lines(stdout)).toHaveLength(2);
    for (const line of lines(stdout)) {
      expect(line.endsWith('\n')).toBe(true);
      expect(line.slice(0, -1)).not.toContain('\n');
    }
    expect(records()).toEqual([
      { msg: 'thing-happened', level: 'info', time: expect.any(String), count: 2 },
      { msg: 'thing-failed', level: 'error', time: expect.any(String), id: 'x' },
    ]);
  });

  it('stamps every record with an ISO time', () => {
    log('info', 'thing-happened');

    const { time } = records()[0];
    expect(new Date(time as string).toISOString()).toBe(time);
  });

  it('drops records below the configured level, but never fatal', () => {
    setLogLevel('error');
    log('debug', 'noise');
    log('info', 'noise');
    log('warn', 'noise');
    log('fatal', 'going-down');

    expect(records()).toEqual([expect.objectContaining({ msg: 'going-down', level: 'fatal' })]);
  });

  it('does not let a field shadow msg, level or time', () => {
    log('info', 'real', { msg: 'fake', level: 'error', time: 'never' });

    expect(records()[0]).toEqual({ msg: 'real', level: 'info', time: expect.any(String) });
  });

  it('keeps an error, its stack and a cycle on one line', () => {
    const cyclic: Record<string, unknown> = { name: 'a' };
    cyclic['self'] = cyclic;
    const error = new Error('outer\nwith a newline', { cause: new Error('inner') });

    log('error', 'failed', { error, cyclic, big: 10n });

    const [line] = lines(stdout);
    expect(line.slice(0, -1)).not.toContain('\n');
    expect(JSON.parse(line)).toMatchObject({
      error: {
        name: 'Error',
        message: 'outer\nwith a newline',
        stack: expect.stringContaining('at '),
        cause: { message: 'inner' },
      },
      cyclic: { name: 'a', self: '[Circular]' },
      big: '10',
    });
  });

  it("reduces a nested GraphQLError's extensions to its code", () => {
    // `GraphQLError#toJSON` runs before the replacer and keeps every extension, the upstream
    // response of a Green Invoice SDK error included.
    const error = new GraphQLError('Upstream HTTP Error: 400', {
      extensions: {
        code: 'DOWNSTREAM_SERVICE_ERROR',
        response: { status: 400, body: { errorMessage: 'client details' } },
      },
    });

    log('error', 'failed', { details: [error], nested: { error } });

    const [line] = lines(stdout);
    expect(line).not.toContain('client details');
    expect(JSON.parse(line)).toMatchObject({
      details: [{ message: 'Upstream HTTP Error: 400', code: 'DOWNSTREAM_SERVICE_ERROR' }],
      nested: { error: { message: 'Upstream HTTP Error: 400', code: 'DOWNSTREAM_SERVICE_ERROR' } },
    });
  });

  it.each([
    ['authorization', { authorization: 'Bearer abc' }],
    ['a nested cookie', { request: { headers: { cookie: 'session=1' } } }],
    ['a token suffix', { details: [{ hiveToken: 'hv-1' }] }],
    ['a hyphenated header', { headers: { 'x-api-key': 'key-1' } }],
    ['a password deep down', { a: { b: { c: { password: 'hunter2' } } } }],
  ])('redacts a credential under %s', (_label, fields) => {
    log('info', 'request', fields);

    const [line] = lines(stdout);
    expect(line).toContain('[REDACTED]');
    expect(line).not.toMatch(/abc|session=1|hv-1|key-1|hunter2/);
  });

  it('scrubs credentials and emails out of free text, messages included', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    log('warn', 'upstream-said', {
      text: `user jane@example.com sent Bearer abcdefgh123 and ${jwt}`,
      hook: 'see https://hooks.slack.com/services/T0/B0/XYZ',
      error: new Error(`token ${jwt} rejected for jane@example.com`),
    });

    const [line] = lines(stdout);
    expect(line).not.toMatch(/jane@example\.com|abcdefgh123|eyJhbGci|hooks\.slack\.com/);
    expect(JSON.parse(line)).toMatchObject({
      text: 'user [email] sent Bearer [redacted] and [jwt]',
      hook: 'see [slack-webhook]',
      error: { message: 'token [jwt] rejected for [email]' },
    });
  });

  it('caps long strings, and error messages harder', () => {
    log('error', 'big', { text: 'x'.repeat(5000), error: new Error('y'.repeat(5000)) });

    const record = records()[0] as { text: string; error: { message: string } };
    expect(record.text.length).toBeLessThan(2050);
    expect(record.text).toMatch(/…\[3000 more\]$/);
    expect(record.error.message.length).toBeLessThan(550);
  });

  it('merges the context provider under the call site fields', () => {
    setLogContextProvider(() => ({ requestId: 'req-ctx-01', operationName: 'FromContext' }));

    log('info', 'with-context', { operationName: 'FromCallSite' });

    expect(records()[0]).toMatchObject({
      requestId: 'req-ctx-01',
      operationName: 'FromCallSite',
    });
  });

  it('still writes the record when the context provider throws', () => {
    setLogContextProvider(() => {
      throw new Error('no context');
    });

    log('info', 'survives');

    expect(records()).toEqual([expect.objectContaining({ msg: 'survives' })]);
  });

  it('sends finished lines to the configured writer', () => {
    const writer = vi.fn();
    setLogWriter(writer);

    log('warn', 'elsewhere');

    expect(lines(stdout)).toEqual([]);
    expect(writer).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('"elsewhere"'), 'warn');
  });

  it('survives stdout failing, as console does', () => {
    stdout.mockImplementation(() => {
      throw Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
    });

    expect(() => log('info', 'into-a-closed-pipe')).not.toThrow();
    expect(process.stdout.listenerCount('error')).toBeGreaterThan(0);
  });
});

describe('serializeError', () => {
  it('keeps the code but not the rest of an error', () => {
    const error = Object.assign(new Error('nope'), { code: '25P03', secret: 'token' });

    const serialized = serializeError(error);

    expect(serialized).toMatchObject({ name: 'Error', message: 'nope', code: '25P03' });
    expect(serialized).not.toHaveProperty('secret');
  });

  it('describes a thrown non-error', () => {
    expect(serializeError('just a string')).toEqual({ message: 'just a string' });
  });

  it('keeps only allowlisted fields of a thrown plain object, also as a cause', () => {
    // Cloudinary rejects with a plain object, which the provider wraps as a cause.
    const sdkRejection = {
      error: { message: 'Resource not found', http_code: 404 },
      request: { headers: { authorization: 'Basic secret' } },
      body: 'payload',
    };
    const wrapped = new Error('Error on deleting file', { cause: sdkRejection });

    const serialized = serializeError(wrapped);

    expect(serialized['cause']).toEqual({ message: 'Resource not found' });
    expect(JSON.stringify(serialized)).not.toContain('secret');
    expect(JSON.stringify(serialized)).not.toContain('payload');
    expect(serializeError({ code: 'E1', status: 500, token: 'x' })).toEqual({
      code: 'E1',
      status: 500,
      message: 'non-error object thrown',
    });
  });
});

describe('createYogaLogger', () => {
  it('writes Yoga and Hive messages as JSON records', () => {
    createYogaLogger().warn('[hive] usage report failed', { status: 500 });

    expect(records()[0]).toEqual({
      msg: '[hive] usage report failed',
      level: 'warn',
      time: expect.any(String),
      source: 'yoga',
      details: [{ status: 500 }],
    });
  });

  it('redacts credentials in the extra arguments it passes through', () => {
    createYogaLogger().info('[hive] request', { headers: { authorization: 'Bearer abcdefgh' } });

    expect(lines(stdout)[0]).not.toContain('abcdefgh');
  });

  it('honours the level, so debug noise stays out at info', () => {
    createYogaLogger().debug('Parsing request to extract GraphQL parameters');

    expect(lines(stdout)).toEqual([]);
  });

  it('skips an error that a boundary already logged', () => {
    const logged = new Error('already logged');
    markLogged(logged);
    const fresh = new Error('not yet logged');

    createYogaLogger().error(logged);
    createYogaLogger().error(fresh);

    expect(records()).toEqual([
      expect.objectContaining({ msg: 'not yet logged', error: expect.anything() }),
    ]);
  });
});
