/**
 * Argument and connection handling for `yarn local:tenant` (`scripts/local-tenant.ts`).
 *
 * Kept apart from the script and free of side effects (no dotenv, no `pg`, no server imports),
 * so the unit test can exercise it without anything that reads `.env` or opens a connection.
 */
import { parseArgs } from 'node:util';
import {
  assertLocalDatabaseOnly,
  type DatabaseTarget,
} from '../packages/migrations/src/local-db-guard.js';

export const LOCAL_TENANT_COMMAND = 'yarn local:tenant';

/** The refusal's "why there is no override" line. */
export const LOCAL_TENANT_REFUSAL_REASON =
  'It creates a dev-only tenant (a dev-auth owner and a scraper API key) that has no place in a ' +
  'deployed database, so it only runs against a local Postgres.';

export const DEFAULT_BUSINESS_NAME = 'Local Business';
export const API_KEY_NAME = 'local-tenant scraper';

/** `docker/docker-compose.dev.yml`'s database, which is what the script targets by default. */
export const DOCKER_COMPOSE_DEFAULTS = {
  host: 'localhost',
  port: '5432',
  db: 'accounter',
  user: 'postgres',
  password: 'postgres',
} as const;

export const USAGE = `Usage: ${LOCAL_TENANT_COMMAND} [--name <business name>] [--rotate-api-key]

Creates, in a LOCAL database only, a tenant ready to receive a scrape: the business with its
admin context, an owner user, the owner's membership, and a scraper-role API key. Prints the ids,
the API key (once, when it is created) and the commands to start the server and the client with
dev auth as that owner. Running it again reports the existing tenant.

Options:
  --name <name>       Business name (default: "${DEFAULT_BUSINESS_NAME}"). The ids derive from it.
  --rotate-api-key    Revoke this tenant's local scraper key and print a new one.
  -h, --help          Show this help.

Connection: POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD and
POSTGRES_SSL from the environment of this command, defaulting to the docker compose database
(localhost:5432/accounter as postgres). The repo .env is not read for the connection. A host
that is not local is refused, and nothing overrides that.`;

export type LocalTenantArgs = {
  help: boolean;
  name: string;
  rotateApiKey: boolean;
};

/** Parse the script's own arguments (`process.argv.slice(2)`). Throws on anything unknown. */
export function parseLocalTenantArgs(argv: readonly string[]): LocalTenantArgs {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      name: { type: 'string' },
      'rotate-api-key': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (positionals.length > 0) {
    throw new Error(`Unexpected argument: ${positionals[0]}. Use --name <business name>.`);
  }

  const name = values.name?.trim() ?? DEFAULT_BUSINESS_NAME;
  if (values.name !== undefined && name === '') {
    throw new Error('--name cannot be empty.');
  }

  return {
    help: values.help ?? false,
    name,
    rotateApiKey: values['rotate-api-key'] ?? false,
  };
}

export type LocalConnection = Required<Omit<DatabaseTarget, 'port'>> & {
  port: number;
  password: string;
  ssl: boolean;
};

function valueOr(value: string | undefined, fallback: string): string {
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

/**
 * Resolve the connection from this command's environment, with the docker compose database as
 * the default, and refuse it unless the host is local. There is no override.
 *
 * The host is always set explicitly on the returned connection, so `pg` never falls back to
 * `PGHOST`. A blank `POSTGRES_HOST` with a `PGHOST` set is still judged by `PGHOST`, because
 * that is what a reader of the environment would expect the command to reach.
 */
export function resolveLocalConnection(env: NodeJS.ProcessEnv): LocalConnection {
  const explicitHost = env.POSTGRES_HOST?.trim() ? env.POSTGRES_HOST.trim() : undefined;
  const host = explicitHost ?? env.PGHOST?.trim() ?? '';
  const connection: LocalConnection = {
    host: host === '' ? DOCKER_COMPOSE_DEFAULTS.host : host,
    port: Number(valueOr(env.POSTGRES_PORT, DOCKER_COMPOSE_DEFAULTS.port)),
    db: valueOr(env.POSTGRES_DB, DOCKER_COMPOSE_DEFAULTS.db),
    user: valueOr(env.POSTGRES_USER, DOCKER_COMPOSE_DEFAULTS.user),
    password: env.POSTGRES_PASSWORD ?? DOCKER_COMPOSE_DEFAULTS.password,
    ssl: env.POSTGRES_SSL === '1',
  };

  if (!Number.isInteger(connection.port) || connection.port <= 0) {
    throw new Error(`POSTGRES_PORT must be a port number, got: ${env.POSTGRES_PORT}`);
  }

  // Judge the host the connection will use. The env passed is only for PGHOST, which no longer
  // matters once the host is set; no variable in it lets a remote target through.
  assertLocalDatabaseOnly(
    { host: connection.host, port: connection.port, db: connection.db, user: connection.user },
    LOCAL_TENANT_COMMAND,
    {},
    LOCAL_TENANT_REFUSAL_REASON,
  );

  return connection;
}

/** The `POSTGRES_*` prefix that points a command at exactly this connection. */
export function connectionEnvPrefix(connection: LocalConnection): string {
  return [
    `POSTGRES_HOST=${connection.host}`,
    `POSTGRES_PORT=${connection.port}`,
    `POSTGRES_DB=${connection.db}`,
    `POSTGRES_USER=${connection.user}`,
    // Only the docker compose default is spelled out; any other password stays out of the
    // terminal and is taken from the shell that runs the printed command.
    connection.password === DOCKER_COMPOSE_DEFAULTS.password
      ? `POSTGRES_PASSWORD=${connection.password}`
      : 'POSTGRES_PASSWORD="$POSTGRES_PASSWORD"',
    `POSTGRES_SSL=${connection.ssl ? '1' : '0'}`,
    `PGHOST=${connection.host}`,
  ].join(' ');
}

/**
 * The commands to run the server and the client with dev auth as `userId`. The server's own
 * `.env` loading never overrides a variable already set, so the prefix pins it to this database.
 */
export function startCommands(connection: LocalConnection, userId: string) {
  const prefix = connectionEnvPrefix(connection);
  return {
    build: 'yarn build',
    server: `${prefix} ALLOW_DEV_AUTH=1 yarn workspace @accounter/server dev`,
    client: `ALLOW_DEV_AUTH=1 DEV_AUTH_USER_ID=${userId} yarn workspace @accounter/client dev`,
    devAuthHeader: `X-Dev-Auth: ${userId}`,
  };
}
