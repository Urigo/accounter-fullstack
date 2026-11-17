import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { envSchema, parseEnv } from '../env.js';

/**
 * Keeps `packages/mcp-server/.env.template` and the README's configuration table in sync with
 * `envSchema`. When this fails, add or remove the entry named in the message — or, for a variable
 * deliberately read outside the schema, add it to `TEMPLATE_EXTRAS` with the reason.
 */

/** Read by the server or its libraries, but not declared in the zod schema. */
const TEMPLATE_EXTRAS: Record<string, string> = {
  NODE_ENV: 'standard Node variable; defaults OTEL_DEPLOYMENT_ENV',
  TEST_ENV_FILE: 'read in loadEnv before any .env file is loaded, to choose which one',
};

const TEMPLATE = new URL('../../../.env.template', import.meta.url);
const README = new URL('../../../README.md', import.meta.url);

/** Variable names in the template, from active (`VAR=`) and commented-out (`# VAR=`) entries. */
function templateKeys(): Set<string> {
  const keys = new Set<string>();
  for (const line of readFileSync(TEMPLATE, 'utf8').split('\n')) {
    const match = /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

/** Variable names in the first column of the README's configuration table. */
function readmeTableKeys(): Set<string> {
  const readme = readFileSync(README, 'utf8');
  const section = readme.slice(readme.indexOf('## Configuration'), readme.indexOf('## Scripts'));
  return new Set([...section.matchAll(/^\| `([A-Z][A-Z0-9_]*)`/gm)].map(match => match[1]));
}

const expected = new Set([...Object.keys(envSchema.shape), ...Object.keys(TEMPLATE_EXTRAS)]);

/** Names the documented set lacks, and names it has that nothing reads. */
function drift(documented: Set<string>) {
  return {
    missing: [...expected].filter(key => !documented.has(key)),
    unknown: [...documented].filter(key => !expected.has(key)),
  };
}

describe('.env.template', () => {
  it('lists exactly the schema variables plus the allowlisted extras', () => {
    expect(drift(templateKeys()), 'packages/mcp-server/.env.template vs envSchema').toEqual({
      missing: [],
      unknown: [],
    });
  });

  it('parses: its active entries are a valid configuration on their own', () => {
    const active = Object.fromEntries(
      readFileSync(TEMPLATE, 'utf8')
        .split('\n')
        .map(line => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line))
        .filter(match => match !== null)
        .map(match => [match[1], match[2]]),
    );
    expect(() => parseEnv(active)).not.toThrow();
  });
});

describe('README configuration table', () => {
  it('lists exactly the schema variables plus the allowlisted extras', () => {
    expect(drift(readmeTableKeys()), 'README.md#configuration vs envSchema').toEqual({
      missing: [],
      unknown: [],
    });
  });
});
