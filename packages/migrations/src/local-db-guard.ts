/**
 * Guard against dev tooling connecting to a non-local Postgres.
 *
 * The repo root `.env` is what codegen, migrations, seeds and every DB-backed test read
 * (`packages/server/src/__tests__/helpers/test-db-config.ts` loads `.env` / `../../.env`;
 * `packages/migrations/src/environment.ts` does the same). When that file points at a
 * deployed database — which is its historical default — commands that look local are not:
 *
 * - `scripts/vitest-global-setup.ts` runs before *every* vitest project, `--project unit`
 *   included, and executes `seedCountries()` — a write.
 * - `packages/migrations/src/__tests__/rls-all-tables.test.ts` issues `CREATE DATABASE`,
 *   then runs every migration into it.
 * - `scripts/seed.ts` and `scripts/seed-demo-data.ts` insert reference and fixture data.
 *
 * This module is the chokepoint that makes "am I about to touch a deployed database?"
 * an explicit decision instead of an assumption about a file nobody re-read.
 *
 * Deliberately dependency-free (no dotenv, no zod, no side effects) so importing it from
 * a test helper, a root script or a package entry point is always safe.
 *
 * **Known limitation:** this inspects the configured host only. A port-forward or SSH
 * tunnel that presents a deployed database as `localhost` is indistinguishable from the
 * dev container and will pass. The guard raises the floor; it is not a sandbox.
 */

/** Opt in to a non-local target for one command. Mirrors `ALLOW_DEMO_SEED`. */
export const ALLOW_REMOTE_DB_ENV = 'ALLOW_REMOTE_DB';

/** Opt in to the demo seed, which TRUNCATEs every domain table (`scripts/seed-demo-data.ts`). */
export const ALLOW_DEMO_SEED_ENV = 'ALLOW_DEMO_SEED';

/**
 * Opt-ins that must come from the command that needs them, never from a `.env` file.
 * See `assertOptInsNotInEnvFile`.
 */
export const PER_COMMAND_OPT_INS = [ALLOW_REMOTE_DB_ENV, ALLOW_DEMO_SEED_ENV] as const;

/** Upgrade the migration CLI's warning to a hard failure. See `assertLocalDatabase`. */
export const ENFORCE_LOCAL_DB_ENV = 'ENFORCE_LOCAL_DB';

export type DatabaseTarget = {
  host?: string | undefined;
  port?: number | string | undefined;
  db?: string | undefined;
  user?: string | undefined;
};

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '::1',
  '0.0.0.0',
  // Docker service name in docker/docker-compose.dev.yml, and the usual escape hatch
  // for reaching the host from inside a container.
  'db',
  'host.docker.internal',
]);

/**
 * Strip what a hand-edited `.env` tends to leave behind: dotenv already removes matching
 * quotes, but a value typed by hand can still carry surrounding whitespace or stray quotes.
 * Shared by classification and display so the two never disagree about what was read.
 */
function stripQuotesAndTrim(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function normalizeHost(host: string): string {
  return stripQuotesAndTrim(host).toLowerCase();
}

/** Upper bound on any single field rendered into a message. */
const MAX_DISPLAY_LENGTH = 120;

/**
 * Render one connection field for human eyes, applying the same trimming used for
 * classification so the message cannot describe a different value than the one judged.
 *
 * Also strips C0/C1 control characters. A stray byte in `.env` would otherwise be echoed
 * verbatim into an error, and an ANSI escape sequence there would corrupt the terminal of
 * whoever is reading it — the one place we can be sure a human is looking.
 */
function sanitizeForDisplay(value: string | number): string {
  const text = stripQuotesAndTrim(String(value)).replace(
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    /[\u0000-\u001F\u007F-\u009F]/g,
    '',
  );
  return text.length > MAX_DISPLAY_LENGTH ? `${text.slice(0, MAX_DISPLAY_LENGTH)}…` : text;
}

/**
 * An absent host is treated as local: both `pg` and libpq default to a local connection
 * when no host is given *and `PGHOST` is unset*.
 *
 * This function classifies the string it is given and nothing else. The `PGHOST` fallback
 * is applied by `resolveTarget` before it gets here, so `assertLocalDatabase` and
 * `warnIfRemoteDatabase` never see an absent host that `pg` would actually resolve remotely.
 */
export function isLocalDatabaseHost(host: string | undefined | null): boolean {
  if (host === undefined || host === null) {
    return true;
  }

  const normalized = normalizeHost(host);
  if (normalized === '') {
    return true;
  }

  // A unix socket directory is by definition local.
  if (normalized.startsWith('/')) {
    return true;
  }

  if (LOCAL_HOSTNAMES.has(normalized)) {
    return true;
  }

  // Whole IPv4 loopback range, not just 127.0.0.1.
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }

  // Bracketed IPv6 loopback, e.g. [::1].
  if (normalized === '[::1]') {
    return true;
  }

  return false;
}

/**
 * Human-readable target with the password omitted — safe to log or put in an error.
 *
 * Every field goes through `sanitizeForDisplay`, so a `.env` value carrying quotes,
 * whitespace or control bytes is shown as the value that was actually classified rather
 * than as raw input.
 */
export function describeDatabaseTarget(target: DatabaseTarget): string {
  const rawHost = target.host === undefined ? '' : sanitizeForDisplay(target.host);
  const rawPort = target.port === undefined ? '' : sanitizeForDisplay(target.port);
  const rawDb = target.db === undefined ? '' : sanitizeForDisplay(target.db);
  const rawUser = target.user === undefined ? '' : sanitizeForDisplay(target.user);

  const host = rawHost === '' ? '<default>' : rawHost;
  const port = rawPort === '' ? '' : `:${rawPort}`;
  const db = rawDb === '' ? '' : `/${rawDb}`;
  const user = rawUser === '' ? '' : `${rawUser}@`;
  return `${user}${host}${port}${db}`;
}

export function isRemoteDatabaseAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[ALLOW_REMOTE_DB_ENV] === '1';
}

type ResolvedTarget = { target: DatabaseTarget; hostFromPgHost: boolean };

/**
 * The host `pg` will actually connect to. Callers pass `host: process.env.POSTGRES_HOST`,
 * and when that is unset or blank `pg` does not fall back to localhost: it reads `PGHOST`
 * first (`config.host || process.env.PGHOST || 'localhost'`, in pg's connection-parameters).
 * Classifying the blank value as local would pass a target `pg` then resolves to whatever
 * `PGHOST` names -- and developers commonly export `PGHOST` for `psql`.
 */
function resolveTarget(target: DatabaseTarget, env: NodeJS.ProcessEnv): ResolvedTarget {
  const hostIsBlank = target.host === undefined || normalizeHost(target.host) === '';
  const pgHost = env['PGHOST'];
  if (hostIsBlank && pgHost !== undefined && normalizeHost(pgHost) !== '') {
    return { target: { ...target, host: pgHost }, hostFromPgHost: true };
  }
  return { target, hostFromPgHost: false };
}

function buildMessage({ target, hostFromPgHost }: ResolvedTarget, context: string): string {
  return [
    `Refusing to run ${context} against a non-local database: ${describeDatabaseTarget(target)}`,
    ...(hostFromPgHost
      ? ['', 'POSTGRES_HOST is unset, so that host comes from PGHOST in your shell (echo $PGHOST).']
      : []),
    '',
    'The repo root .env is shared by codegen, migrations, seeds and all DB-backed tests, so a',
    'command that looks local is only as local as that file currently is. Check it now:',
    '',
    "  grep '^POSTGRES' .env",
    '',
    'Then either point it at the dev container, or override for this command only:',
    '',
    '  POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=accounter \\',
    '    POSTGRES_USER=postgres POSTGRES_SSL=0 <your command>',
    '',
    `If you genuinely mean to target ${describeDatabaseTarget(target)}, opt in explicitly:`,
    '',
    `  ${ALLOW_REMOTE_DB_ENV}=1 <your command>`,
  ].join('\n');
}

/**
 * Throw unless the target is local or `ALLOW_REMOTE_DB=1` is set.
 *
 * Use this wherever a deployed database is never the intended target: the test harness and
 * the seed scripts. `context` is quoted verbatim in the error, so name the actual command
 * ("the vitest global setup", "scripts/seed.ts").
 */
export function assertLocalDatabase(
  target: DatabaseTarget,
  context: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const resolved = resolveTarget(target, env);
  if (isLocalDatabaseHost(resolved.target.host) || isRemoteDatabaseAllowed(env)) {
    return;
  }
  throw new Error(buildMessage(resolved, context));
}

/**
 * Warn — loudly, on stderr — when the target is not local, and throw instead if
 * `ENFORCE_LOCAL_DB=1` is set.
 *
 * This is the weaker form, for `migration:run`. A hard default there is not safe yet:
 * production deploys are believed to apply migrations during the build, but that belief
 * traces only to `packages/server/docs/demo-staging-guide.md:552-558`, which documents
 * *staging on Render* while production Postgres runs on Azure — so it says nothing reliable
 * about the production deploy path, and nothing else in the repo does either. Until someone
 * confirms where production migrations actually run, throwing by default risks breaking a
 * deploy nobody can see.
 *
 * Set `ENFORCE_LOCAL_DB=1` in your shell profile to get the strict behaviour locally, and
 * flip this call site to `assertLocalDatabase` once the deploy path is known.
 */
export function warnIfRemoteDatabase(
  target: DatabaseTarget,
  context: string,
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Console, 'warn'> = console,
): void {
  const resolved = resolveTarget(target, env);
  if (isLocalDatabaseHost(resolved.target.host) || isRemoteDatabaseAllowed(env)) {
    return;
  }

  if (env[ENFORCE_LOCAL_DB_ENV] === '1') {
    throw new Error(buildMessage(resolved, context));
  }

  logger.warn(
    [
      '',
      '  ⚠️  ================================================================',
      `  ⚠️  ${context} is targeting a NON-LOCAL database:`,
      `  ⚠️    ${describeDatabaseTarget(resolved.target)}${resolved.hostFromPgHost ? ' (from PGHOST)' : ''}`,
      '  ⚠️',
      "  ⚠️  If that was not deliberate, stop now (Ctrl-C) and check: grep '^POSTGRES' .env",
      `  ⚠️  Set ${ENFORCE_LOCAL_DB_ENV}=1 to make this a hard failure instead of a warning.`,
      '  ⚠️  ================================================================',
      '',
    ].join('\n'),
  );
}

/**
 * Throw if a `.env` file sets any of `PER_COMMAND_OPT_INS`.
 *
 * Every guard here reads its opt-in from `process.env`, and by the time it runs dotenv has
 * already copied the `.env` file into `process.env` -- so an opt-in left in that file is
 * indistinguishable from one typed for the command, and switches the guard off for every
 * command that reads the file. The vitest global setup's load also reaches every test worker.
 *
 * Pass the `parsed` field of dotenv's `config()` result: it holds every key the file(s)
 * define, including those that did not override a variable already set. Presence alone is
 * refused, whatever the value, so the rule is simply "not in the file".
 *
 * `source` names the file(s) in the error, e.g. ".env".
 */
export function assertOptInsNotInEnvFile(
  parsed: Readonly<Record<string, string>> | undefined,
  source: string,
): void {
  // dotenv values are always strings (an empty `KEY=` included), so undefined means absent.
  const found = PER_COMMAND_OPT_INS.filter(key => parsed?.[key] !== undefined);
  if (found.length === 0) {
    return;
  }
  throw new Error(
    [
      `Refusing to run: ${found.join(' and ')} ${found.length === 1 ? 'is' : 'are'} set in ${source}.`,
      '',
      'These are per-command opt-ins. In an env file they are read by every command that loads it,',
      'which silently turns off the guards that stop tests and seeds from touching a deployed',
      'database. Remove them from the file and pass them to the one command that needs them:',
      '',
      ...found.map(key => `  ${key}=1 <your command>`),
    ].join('\n'),
  );
}
