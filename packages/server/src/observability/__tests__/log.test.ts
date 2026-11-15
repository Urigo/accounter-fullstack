import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  createYogaLogger,
  getLogger,
  knownLogModules,
  log,
  markLogged,
  originOf,
  serializeError,
  setLogBaseFields,
  setLogContextProvider,
  setLogLevel,
  setLogWriter,
  setModuleLogLevels,
} from '../log.js';

let stdout: MockInstance;
let stderr: MockInstance;

beforeEach(() => {
  stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
});

afterEach(() => {
  setLogLevel('info');
  setLogBaseFields();
  setModuleLogLevels();
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

  it('detects a cycle after an error with a cause', () => {
    const request: Record<string, unknown> = {};
    request['context'] = { error: new Error('outer', { cause: new Error('inner') }), request };

    log('error', 'failed', { request });

    expect(records()[0]).toMatchObject({
      request: { context: { error: { cause: { message: 'inner' } }, request: '[Circular]' } },
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

  it('scrubs an error message before cutting it, so a cut never splits a JWT', () => {
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${'eyJzdWIiOiIxIn0'.repeat(10)}.c2lnbmF0dXJl`;
    // The token straddles the 500-character message cap.
    log('error', 'failed', { error: new Error(`${'x'.repeat(480)} ${jwt}`) });

    const [line] = lines(stdout);
    expect(line).not.toContain('eyJ');
  });

  it('scrubs and caps the fallback record when a field cannot be serialized', () => {
    const hostile = {
      get value(): never {
        throw new Error(`cannot read for jane@example.com ${'y'.repeat(1000)}`);
      },
    };

    log('error', 'hostile-field', { hostile });

    const record = records()[0] as { logError: string };
    expect(record).toMatchObject({ msg: 'hostile-field', level: 'error' });
    expect(record.logError).toContain('[email]');
    expect(record.logError).not.toContain('jane@example.com');
    expect(record.logError.length).toBeLessThan(550);
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

describe('origin tags', () => {
  it.each([
    ['file:///app/packages/server/src/modules/charges/resolvers/charges.resolver.ts', 'charges', 'charges.resolver'],
    ['/app/packages/server/dist/modules/deel/providers/deel-client.provider.js', 'deel', 'deel-client.provider'],
    ['file:///app/packages/server/src/plugins/request-log-plugin.ts', 'plugins', 'request-log-plugin'],
    ['file:///app/packages/server/dist/observability/pool-monitor.js', 'observability', 'pool-monitor'],
    ['file:///app/packages/server/dist/index.js', 'startup', 'index'],
    ['file:///app/packages/server/src/environment.ts', 'environment', 'environment'],
    // The checkout itself under a `src`: the last one wins
    ['file:///home/me/src/accounter/packages/server/src/modules/tags/index.ts', 'tags', 'index'],
  ])('derives the origin of %s', (url, module, component) => {
    expect(originOf(url)).toEqual({ module, component });
  });

  it('uses each module directory name as its log module', () => {
    const modulesDir = fileURLToPath(new URL('../../modules/', import.meta.url));
    const directories = readdirSync(modulesDir, { withFileTypes: true }).filter(entry =>
      entry.isDirectory(),
    );

    expect(directories.length).toBeGreaterThan(0);
    for (const { name } of directories) {
      const url = pathToFileURL(`${modulesDir}${name}/helpers/some.helper.ts`).href;
      expect(originOf(url).module).toBe(name);
    }
  });

  it('binds module and component, and a call-site field overrides them', () => {
    const scoped = getLogger('file:///app/packages/server/src/modules/deel/helpers/sync.helper.ts');

    scoped.info('synced', { count: 1 });
    scoped.log('warn', 'overridden', { component: 'custom' });

    expect(records()).toEqual([
      expect.objectContaining({ msg: 'synced', module: 'deel', component: 'sync.helper', count: 1 }),
      expect.objectContaining({ msg: 'overridden', level: 'warn', module: 'deel', component: 'custom' }),
    ]);
  });

  it('lets an infra scope replace the derived module, keeping the component', () => {
    const { log: dbLog } = getLogger(
      'file:///app/packages/server/src/modules/app-providers/tenant-db-client.ts',
      { module: 'db' },
    );

    dbLog('error', 'db-thing-failed');

    expect(records()).toEqual([
      expect.objectContaining({ msg: 'db-thing-failed', module: 'db', component: 'tenant-db-client' }),
    ]);
  });

  it('stamps base fields on every record, below the call site and never over msg/level/time', () => {
    setLogBaseFields({ service: 'accounter-server', env: 'test', release: 'abc123', msg: 'shadow' });

    log('info', 'with-base');
    log('info', 'override', { env: 'call-site' });

    expect(records()).toEqual([
      expect.objectContaining({ msg: 'with-base', service: 'accounter-server', env: 'test', release: 'abc123' }),
      expect.objectContaining({ msg: 'override', service: 'accounter-server', env: 'call-site' }),
    ]);
  });
});

describe('per-module levels', () => {
  const deel = getLogger('file:///app/packages/server/src/modules/deel/helpers/sync.helper.ts');
  const charges = getLogger('file:///app/packages/server/src/modules/charges/helpers/x.helper.ts');

  it("applies a module's own level, and the process-wide one to every other module", () => {
    setModuleLogLevels({ deel: 'debug', charges: 'error' });

    deel.debug('deel-detail');
    charges.warn('charges-warning');
    charges.error('charges-failed');
    charges.fatal('charges-fatal');
    log('debug', 'unscoped-detail');

    expect(records().map(record => record['msg'])).toEqual([
      'deel-detail',
      'charges-failed',
      'charges-fatal',
    ]);
  });

  it('knows the module directories, the top-level directories and the infra scopes', () => {
    const known = knownLogModules();

    for (const module of ['charges', 'deel', 'plugins', 'observability', 'startup', 'db', 'shutdown']) {
      expect(known).toContain(module);
    }
    expect(known).not.toContain('modules');
    expect(known).not.toContain('__tests__');
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

  it('leaves out an undefined attributes argument, as Hive passes one', () => {
    createYogaLogger().info('[hive] usage report sent', undefined);

    expect(records()[0]).not.toHaveProperty('details');
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
      expect.objectContaining({ msg: 'yoga-error', error: expect.objectContaining({ message: 'not yet logged' }) }),
    ]);
  });
});
