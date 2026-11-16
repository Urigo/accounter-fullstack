// @vitest-environment node
// Reads files from disk, so it runs in node rather than the client project's happy-dom default.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLIENT_BUILD_ENV, clientBuildEnvDefines } from '../../build-env.js';

/**
 * Keeps `packages/client/.env.template`, `build-env.ts` and `src/vite-env.d.ts` in sync, and keeps
 * client-only variables out of the root `.env.template`. When this fails, add, remove or move the
 * entry named in the message.
 */

/** Client variables the server reads too, so they also belong in the root template. */
const SHARED_WITH_ROOT = ['AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'ALLOW_DEV_AUTH'];

const CLIENT_TEMPLATE = new URL('../../.env.template', import.meta.url);
const ROOT_TEMPLATE = new URL('../../../../.env.template', import.meta.url);
const VITE_ENV_TYPES = new URL('../vite-env.d.ts', import.meta.url);

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

const sources = Object.keys(CLIENT_BUILD_ENV);
const sorted = (values: Iterable<string>) => [...values].sort();

describe('client .env.template', () => {
  it('lists exactly the variables build-env.ts reads', () => {
    expect(sorted(templateKeys(CLIENT_TEMPLATE)), 'packages/client/.env.template vs build-env.ts').toEqual(
      sorted(sources),
    );
  });

  it('declares exactly the VITE_* names build-env.ts defines', () => {
    const declared = [
      ...readFileSync(VITE_ENV_TYPES, 'utf8').matchAll(/readonly (VITE_[A-Z0-9_]+)\??:/g),
    ].map(match => match[1]);
    expect(sorted(declared), 'src/vite-env.d.ts vs build-env.ts').toEqual(
      sorted(Object.values(CLIENT_BUILD_ENV)),
    );
  });

  it('keeps client-only variables out of the root template', () => {
    const root = templateKeys(ROOT_TEMPLATE);

    const missingShared = SHARED_WITH_ROOT.filter(key => !root.has(key));
    expect(missingShared, 'add these shared variables to the root .env.template').toEqual([]);

    const clientOnly = sources.filter(key => root.has(key) && !SHARED_WITH_ROOT.includes(key));
    expect(
      clientOnly,
      'these are client-only: move them from the root .env.template to packages/client/.env.template',
    ).toEqual([]);
  });
});

describe('clientBuildEnvDefines', () => {
  it('inlines each set variable under its VITE_* name', () => {
    const defines = clientBuildEnvDefines({ AUTH0_DOMAIN: 'tenant.auth0.com', ALLOW_DEV_AUTH: '1' });
    expect(defines['import.meta.env.VITE_AUTH0_DOMAIN']).toBe('"tenant.auth0.com"');
    expect(defines['import.meta.env.VITE_DEV_AUTH']).toBe('"1"');
  });

  it('inlines an empty string for an unset GRAPHQL_URL, so the per-mode default applies', () => {
    expect(clientBuildEnvDefines({})['import.meta.env.VITE_GRAPHQL_URL']).toBe('""');
  });

  it('leaves other unset variables undefined', () => {
    expect(clientBuildEnvDefines({})['import.meta.env.VITE_AUTH0_AUDIENCE']).toBeUndefined();
  });
});
