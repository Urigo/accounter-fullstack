import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Keeps `packages/server/.env.template` (and the server's share of the root `.env.template`) in
 * sync with the schema in `environment.ts`. When this fails, add, remove or move the template entry
 * named in the message — or, for a variable that is deliberately read outside the schema, add it to
 * `SERVER_TEMPLATE_EXTRAS` with the reason.
 */

/** Read by the server or a library it runs, but not declared in the zod schema. */
const SERVER_TEMPLATE_EXTRAS: Record<string, string> = {
  NODE_ENV: 'standard Node variable; defaults OTEL_DEPLOYMENT_ENV and is read by libraries',
  RELEASE: 'read in environment.ts before the schema runs, to silence dotenv debug output',
  TEST_ENV_FILE: 'read in environment.ts before any .env file is loaded, to choose which one',
  DEBUG: 'read by debug-based libraries; the server itself ignores it',
  ANTHROPIC_API_KEY: 'read directly by @ai-sdk/anthropic',
  GREEN_INVOICE_LOG_LEVEL: 'read directly by @accounter/green-invoice-graphql',
};

/**
 * Server variables that other packages read too, so they also belong in the root template. Any
 * other server variable in the root template is backend-only and belongs in the server template.
 */
const SHARED_WITH_ROOT = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_SSL',
  'AUTH0_DOMAIN',
  'AUTH0_AUDIENCE',
  'ALLOW_DEV_AUTH',
  'DEBUG',
];

const SERVER_TEMPLATE = new URL('../.env.template', import.meta.url);
const ROOT_TEMPLATE = new URL('../../../.env.template', import.meta.url);

/** Variable names in a template, from active (`VAR=`) and commented-out (`# VAR=`) entries alike. */
function templateKeys(file: URL): Set<string> {
  const keys = new Set<string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

const REQUIRED = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_DB: 'test',
  POSTGRES_USER: 'test',
  POSTGRES_PASSWORD: 'test',
  CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('.env.template', () => {
  let schemaKeys: ReadonlySet<string>;
  let original: Record<string, string | undefined>;

  // `environment.ts` validates on import, so it needs a valid environment to load at all.
  beforeAll(async () => {
    original = Object.fromEntries(Object.keys(REQUIRED).map(key => [key, process.env[key]]));
    Object.assign(process.env, REQUIRED);
    vi.resetModules();
    ({ ENV_SCHEMA_KEYS: schemaKeys } = await import('./environment.js'));
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.resetModules();
  });

  it('finds the schema keys', () => {
    // Guards the walk over the zod models: an empty set would make the checks below pass vacuously.
    expect(schemaKeys).toContain('POSTGRES_HOST');
    expect(schemaKeys).toContain('AUTH0_DOMAIN');
  });

  it('lists every schema variable in the server template', () => {
    const template = templateKeys(SERVER_TEMPLATE);
    const missing = [...schemaKeys].filter(key => !template.has(key));
    expect(missing, 'add these to packages/server/.env.template').toEqual([]);
  });

  it('lists nothing in the server template that the server does not read', () => {
    const unknown = [...templateKeys(SERVER_TEMPLATE)].filter(
      key => !schemaKeys.has(key) && !(key in SERVER_TEMPLATE_EXTRAS),
    );
    expect(
      unknown,
      'remove these from packages/server/.env.template, or add them to the schema or SERVER_TEMPLATE_EXTRAS',
    ).toEqual([]);
  });

  it('keeps every allowlisted extra in the server template', () => {
    const template = templateKeys(SERVER_TEMPLATE);
    const stale = Object.keys(SERVER_TEMPLATE_EXTRAS).filter(key => !template.has(key));
    expect(
      stale,
      'document these in packages/server/.env.template, or drop them from the allowlist',
    ).toEqual([]);
  });

  it('shares exactly the shared variables with the root template', () => {
    const root = templateKeys(ROOT_TEMPLATE);
    const server = templateKeys(SERVER_TEMPLATE);

    const missingShared = SHARED_WITH_ROOT.filter(key => !root.has(key));
    expect(missingShared, 'add these shared variables to the root .env.template').toEqual([]);

    const backendOnly = [...root].filter(
      key =>
        (schemaKeys.has(key) || key in SERVER_TEMPLATE_EXTRAS || server.has(key)) &&
        !SHARED_WITH_ROOT.includes(key),
    );
    expect(
      backendOnly,
      'these are backend-only: move them from the root .env.template to packages/server/.env.template',
    ).toEqual([]);
  });
});
