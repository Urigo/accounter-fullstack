import { assertLocalDatabase } from '../../migrations/src/local-db-guard.js';

/**
 * Everything the e2e run points at, in one place.
 *
 * The database is never read from `.env`: the repo root `.env` is what the server, codegen and
 * Vite fall back to, and it historically points at production. Each value here comes from an
 * `E2E_`-prefixed variable or a local default, and the server, seed and client build all receive
 * it explicitly, so a missing variable can't fall through to that file.
 */
export const e2eDatabase = {
  host: process.env.E2E_POSTGRES_HOST || 'localhost',
  port: Number(process.env.E2E_POSTGRES_PORT || 5434),
  user: process.env.E2E_POSTGRES_USER || 'postgres',
  password: process.env.E2E_POSTGRES_PASSWORD || 'postgres',
  database: process.env.E2E_POSTGRES_DB || 'accounter_e2e',
};

/**
 * Refuses anything but a local, e2e-only database. The seed drops and recreates it, so on top of
 * the shared local-host guard (with `ALLOW_REMOTE_DB` deliberately not honoured) the name must say
 * it is disposable.
 */
export function assertE2eDatabase(): void {
  assertLocalDatabase(
    {
      host: e2eDatabase.host,
      port: e2eDatabase.port,
      db: e2eDatabase.database,
      user: e2eDatabase.user,
    },
    'the e2e suite',
    {},
  );
  if (!/_e2e$/.test(e2eDatabase.database)) {
    throw new Error(
      `Refusing to run the e2e suite against "${e2eDatabase.database}": the seed drops and ` +
        'recreates its database, so the name must end in "_e2e".',
    );
  }
}

/** The GraphQL server's port. Fixed in `packages/server/src/index.ts`. */
export const SERVER_PORT = 4000;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;
export const GRAPHQL_URL = `${SERVER_URL}/graphql`;

/** `vite preview`'s port. Not Vite's 4173 default, so a preview left running elsewhere can't be reused. */
export const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT || 4183);
export const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;

/** The user every request authenticates as, through `X-Dev-Auth`. Seeded as the owner's member. */
export const E2E_USER_ID = '00000000-0000-4000-8000-00000000e2e1';

/** `POSTGRES_*` for the seed and the server. */
export function postgresEnv(): Record<string, string> {
  return {
    POSTGRES_HOST: e2eDatabase.host,
    POSTGRES_PORT: String(e2eDatabase.port),
    POSTGRES_USER: e2eDatabase.user,
    POSTGRES_PASSWORD: e2eDatabase.password,
    POSTGRES_DB: e2eDatabase.database,
    POSTGRES_SSL: '0',
  };
}
