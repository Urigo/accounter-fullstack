import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = 'secret-access-token-4870';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const BODY_MARKER = 'Client tax ID 515151515';

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
const ENV_VARS = ['DEBUG', 'LOG_LEVEL', 'GREEN_INVOICE_LOG_LEVEL'] as const;

describe('getMeshSDK logging', () => {
  const previousEnv = Object.fromEntries(ENV_VARS.map(name => [name, process.env[name]]));
  let output: string[];

  beforeEach(() => {
    for (const name of ENV_VARS) {
      delete process.env[name];
    }
    // The logger is built when the module loads, so each test reloads it under its own env
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
    for (const name of ENV_VARS) {
      const previous = previousEnv[name];
      if (previous === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previous;
      }
    }
  });

  /** Loads the client under the current env, makes one call, and returns everything logged */
  async function callAndCaptureLogs(): Promise<string> {
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

    return output.join('\n');
  }

  function expectNothingSensitive(logged: string) {
    expect(logged).not.toContain(TOKEN);
    expect(logged.toLowerCase()).not.toContain('authorization');
    expect(logged).not.toContain(BODY_MARKER);
  }

  it.each([
    ['DEBUG', '1'],
    ['LOG_LEVEL', 'debug'],
  ])('logs no token, headers or response body with %s=%s', async (name, value) => {
    process.env[name] = value;

    expectNothingSensitive(await callAndCaptureLogs());
  });

  it('logs the upstream request only when GREEN_INVOICE_LOG_LEVEL opts in to debug', async () => {
    process.env['GREEN_INVOICE_LOG_LEVEL'] = 'debug';

    const logged = await callAndCaptureLogs();

    expect(logged).toContain('Fetching');
    expect(logged).toContain(TOKEN);
  });

  it('falls back to info, with a warning, for an unknown GREEN_INVOICE_LOG_LEVEL', async () => {
    process.env['GREEN_INVOICE_LOG_LEVEL'] = 'verbose';

    const logged = await callAndCaptureLogs();

    expect(logged).toContain('Ignoring unknown GREEN_INVOICE_LOG_LEVEL "verbose"; using "info"');
    expectNothingSensitive(logged);
  });
});
