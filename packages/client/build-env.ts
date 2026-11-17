/**
 * The environment variables the client reads, and the `import.meta.env` name each one is
 * exposed under.
 *
 * They are read once, at build time (or when the dev server starts), from the process environment,
 * `packages/client/.env` or the root `.env`, in that order, and inlined into the bundle through
 * Vite's `define`. Anything inlined ends up in public JavaScript, so none of them may be a secret.
 *
 * `packages/client/.env.template` documents each one; `src/__tests__/env-template.test.ts` keeps
 * this map, the template and `src/vite-env.d.ts` in sync.
 */
export const CLIENT_BUILD_ENV = {
  AUTH0_DOMAIN: 'VITE_AUTH0_DOMAIN',
  AUTH0_FRONTEND_CLIENT_ID: 'VITE_AUTH0_FRONTEND_CLIENT_ID',
  AUTH0_AUDIENCE: 'VITE_AUTH0_AUDIENCE',
  GRAPHQL_URL: 'VITE_GRAPHQL_URL',
  ALLOW_DEV_AUTH: 'VITE_DEV_AUTH',
  DEV_AUTH_USER_ID: 'VITE_DEV_AUTH_USER_ID',
} as const;

/**
 * `GRAPHQL_URL` is inlined as an empty string when unset, rather than the literal `undefined`, so
 * `resolveGraphQLUrl` can test for it and fall back to its per-mode default. The others keep
 * `undefined` when unset (Auth0 treats an empty `audience` differently from a missing one).
 */
const EMPTY_WHEN_UNSET: ReadonlySet<keyof typeof CLIENT_BUILD_ENV> = new Set(['GRAPHQL_URL']);

/** Vite `define` entries for {@link CLIENT_BUILD_ENV}. */
export function clientBuildEnvDefines(
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  return Object.fromEntries(
    (Object.keys(CLIENT_BUILD_ENV) as Array<keyof typeof CLIENT_BUILD_ENV>).map(source => [
      `import.meta.env.${CLIENT_BUILD_ENV[source]}`,
      JSON.stringify(EMPTY_WHEN_UNSET.has(source) ? (env[source] ?? '') : env[source]),
    ]),
  );
}
