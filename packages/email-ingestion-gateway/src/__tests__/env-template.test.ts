import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { WorkerEnv } from '../worker.js';

// `environment.ts` loads `.env` on import; keep it from reading a developer's local file.
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

/**
 * Keeps the env reference files in sync with the code: `.env.template` and the README's gateway
 * table with `environment.ts`, and `.dev.vars.example` and the README's Worker table with
 * `WorkerEnv`. When this fails, add or remove the entry named in the message.
 */

/** Read by the gateway service, but not declared in the zod schema. */
const GATEWAY_EXTRAS: Record<string, string> = {
  NODE_ENV: '`production` makes CF_WEBHOOK_SECRET mandatory; `test` skips listen()',
  DOTENV_DEBUG: 'read before the schema runs, to turn on dotenv diagnostics',
  TEST_ENV_FILE: 'read before any .env file is loaded, to choose which one',
};

/**
 * Every `WorkerEnv` key. Typed as a `Record` over `keyof WorkerEnv`, so `tsc` fails here when a
 * Worker variable is added or removed without updating this list.
 */
const WORKER_KEYS: Record<keyof WorkerEnv, true> = {
  CF_WEBHOOK_SECRET: true,
  GATEWAY_URL: true,
  EMAIL_FORWARD_DESTINATION: true,
  FALLBACK_EMAIL: true,
  HEALTH_PROBE_TIMEOUT_MS: true,
};

const PACKAGE_ROOT = new URL('../../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, PACKAGE_ROOT), 'utf8');

/** Variable names in an env file, from active (`VAR=`) and commented-out (`# VAR=`) entries. */
function fileKeys(file: string): Set<string> {
  const keys = new Set<string>();
  for (const line of read(file).split('\n')) {
    const match = /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

/** Variable names in the first column of the README table under `heading`. */
function readmeTableKeys(heading: string): Set<string> {
  const readme = read('README.md');
  const start = readme.indexOf(heading);
  const end = readme.indexOf('\n#', start + heading.length);
  const section = readme.slice(start, end === -1 ? undefined : end);
  return new Set([...section.matchAll(/^\| `([A-Z][A-Z0-9_]*)`/gm)].map(match => match[1]));
}

/** Names the documented set lacks, and names it has that nothing reads. */
function drift(expected: Set<string>, documented: Set<string>) {
  return {
    missing: [...expected].filter(key => !documented.has(key)),
    unknown: [...documented].filter(key => !expected.has(key)),
  };
}

const NO_DRIFT = { missing: [], unknown: [] };

describe('gateway service env', () => {
  let expected: Set<string>;

  beforeAll(async () => {
    vi.resetModules();
    const { ENV_SCHEMA_KEYS } = await import('../environment.js');
    expect(ENV_SCHEMA_KEYS.size, 'walked no schema keys').toBeGreaterThan(0);
    expected = new Set([...ENV_SCHEMA_KEYS, ...Object.keys(GATEWAY_EXTRAS)]);
  });

  afterAll(() => {
    vi.resetModules();
  });

  it('.env.template lists exactly what the gateway reads', () => {
    expect(drift(expected, fileKeys('.env.template')), '.env.template vs environment.ts').toEqual(
      NO_DRIFT,
    );
  });

  it('the README gateway table lists exactly what the gateway reads', () => {
    expect(
      drift(expected, readmeTableKeys('### Gateway service env')),
      'README gateway table vs environment.ts',
    ).toEqual(NO_DRIFT);
  });
});

describe('Cloudflare Worker env', () => {
  const expected = new Set(Object.keys(WORKER_KEYS));

  it('.dev.vars.example lists exactly the WorkerEnv variables', () => {
    expect(drift(expected, fileKeys('.dev.vars.example')), '.dev.vars.example vs WorkerEnv').toEqual(
      NO_DRIFT,
    );
  });

  it('the README Worker table lists exactly the WorkerEnv variables', () => {
    expect(
      drift(expected, readmeTableKeys('### Cloudflare Worker env')),
      'README Worker table vs WorkerEnv',
    ).toEqual(NO_DRIFT);
  });
});
