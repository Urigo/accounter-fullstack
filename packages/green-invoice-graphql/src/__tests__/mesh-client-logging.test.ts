import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = 'secret-access-token-4870';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const BODY_MARKER = 'Client tax ID 515151515';

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;

describe('getMeshSDK logging', () => {
  const previousDebug = process.env['DEBUG'];
  let output: string[];

  beforeEach(() => {
    // The logger is built when the module loads, so reload it with DEBUG set
    process.env['DEBUG'] = '1';
    vi.resetModules();
    output = [];
    for (const method of CONSOLE_METHODS) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        output.push(args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
      });
    }
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      output.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      output.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousDebug === undefined) {
      delete process.env['DEBUG'];
    } else {
      process.env['DEBUG'] = previousDebug;
    }
  });

  it('logs no token, headers or response body even with DEBUG set', async () => {
    const { getMeshSDK } = await import('../mesh-client.js');
    const fetchFn = (async () =>
      new Response(JSON.stringify({ id: CLIENT_ID, name: BODY_MARKER, country: 'IL' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;

    const { getClient } = await getMeshSDK({ authToken: TOKEN, fetch: fetchFn }).getClient_query({
      id: CLIENT_ID,
    });
    expect(getClient).toMatchObject({ name: BODY_MARKER });

    const logged = output.join('\n');
    expect(logged).not.toContain(TOKEN);
    expect(logged.toLowerCase()).not.toContain('authorization');
    expect(logged).not.toContain(BODY_MARKER);
  });
});
