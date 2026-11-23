/**
 * Decides which databases the demo seed may reset, and holds the reset itself.
 *
 * `scripts/seed-demo-data.ts` starts by truncating the domain tables. On a demo environment
 * that is the point of it; anywhere else it is data loss. `ALLOW_DEMO_SEED=1` alone cannot
 * carry that decision, because it says "run the seed", not "this database is a demo", and it
 * can be set by something that never looked at the target. The demo seed test used to set it
 * for the script, so a test run on a machine whose root `.env` pointed at a deployed database
 * was enough to truncate that database.
 *
 * The rule here is on the database *name*, and it is applied twice: to the configured name
 * before any connection is opened, and to the name the server reports right before the
 * TRUNCATE (`resetDemoSeedTables`). The TRUNCATE statement lives in this module so the seed
 * script has no way to reach it that skips the second check.
 *
 * Why the name and not the data. A check such as "refuse if the database holds businesses the
 * seed did not create" reads better and fails where it matters. Every table the seed touches is
 * FORCE ROW LEVEL SECURITY with `owner_id = ANY (get_current_business_scope())`, and the seed
 * pins its session to the demo admin business. A deployed database is reached as a
 * non-superuser, so that query is filtered to the demo tenant: on a production database full of
 * other tenants' rows it returns zero, while TRUNCATE ignores row security and removes them
 * all. Only a superuser sees the rows, which is the local case that needs no protection.
 */
import {
  describeDatabaseTarget,
  isLocalDatabaseHost,
  sanitizeForDisplay,
  stripQuotesAndTrim,
  type DatabaseTarget,
} from '../packages/migrations/src/local-db-guard.js';

/**
 * Names the one remote database the demo seed may reset although its name does not mark it as
 * a demo environment. The value must equal the database name exactly, so it confirms a single
 * database and nothing else: a value left behind in a shell profile, or copied to another
 * environment together with the rest of its settings, stops matching and stops working.
 *
 * Deliberately not `ALLOW_REMOTE_DB=1`. That variable is a general "this command may leave the
 * machine" switch, the local-database guard prints it as the way past a refusal, and it is set
 * for reasons that have nothing to do with wiping a database.
 */
export const ALLOW_DEMO_SEED_DATABASE_ENV = 'ALLOW_DEMO_SEED_DATABASE';

/**
 * A database name carrying one of these words is a demo environment: the seed may reset it on
 * a remote host with no further confirmation. This is what keeps a staging deploy working
 * without a new variable (`accounter_staging_db`, `accounter_staging`).
 */
export const DEMO_DATABASE_WORDS = [
  'staging',
  'stage',
  'demo',
  'test',
  'testing',
  'preview',
  'sandbox',
  'e2e',
  'local',
] as const;

/** A database name carrying one of these words is never reset: no host, no variable. */
export const PRODUCTION_DATABASE_WORDS = ['prod', 'production', 'prd', 'live'] as const;

/**
 * Tables the demo seed owns and clears before it inserts. Domain tables only: schema,
 * migrations and reference data (countries, exchange rates) are left alone.
 */
export const DEMO_SEED_TABLES = [
  'ledger_records',
  'documents',
  'transactions',
  'charges',
  'financial_accounts_tax_categories',
  'financial_accounts',
  'invitations',
  'business_users',
  'tags',
  'tax_categories',
  'businesses',
  'user_context',
  'financial_entities',
] as const;

/** Thrown for every "the demo seed will not run here" answer, so callers can print it plainly. */
export class DemoSeedRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoSeedRefusedError';
  }
}

export type DemoSeedTargetVerdict =
  | { allowed: true; because: 'local-host' | 'demo-name' | 'named-by-operator' }
  | { allowed: false; because: 'production-name' | 'not-a-demo-name' | 'name-mismatch' };

/**
 * A word counts when no letter touches it: `accounter_staging_db` and `staging2` carry
 * "staging", while `latest` does not carry "test" and `reproduce` does not carry "prod".
 * Digits and punctuation are separators, so `prod2` and `e2e` behave as expected.
 */
function carriesWord(name: string, words: readonly string[]): boolean {
  return new RegExp(`(?<![a-z])(?:${words.join('|')})(?![a-z])`).test(name);
}

function databaseName(target: DatabaseTarget): string {
  return target.db === undefined ? '' : stripQuotesAndTrim(target.db);
}

/**
 * Whether the demo seed may reset this target.
 *
 * 1. A production name is refused first, on any host. The host check cannot see through a
 *    tunnel or port-forward that presents a deployed database as `localhost`; the name can.
 * 2. A local host passes: the dev container and the CI service container, where the default
 *    database name (`accounter`) says nothing either way.
 * 3. A remote database passes when its name marks it as a demo environment.
 * 4. Any other remote database passes only when `ALLOW_DEMO_SEED_DATABASE` names it exactly.
 */
export function classifyDemoSeedTarget(
  target: DatabaseTarget,
  env: NodeJS.ProcessEnv = process.env,
): DemoSeedTargetVerdict {
  const name = databaseName(target);
  const lowered = name.toLowerCase();

  if (carriesWord(lowered, PRODUCTION_DATABASE_WORDS)) {
    return { allowed: false, because: 'production-name' };
  }
  if (isLocalDatabaseHost(target.host)) {
    return { allowed: true, because: 'local-host' };
  }
  if (carriesWord(lowered, DEMO_DATABASE_WORDS)) {
    return { allowed: true, because: 'demo-name' };
  }

  const named = stripQuotesAndTrim(env[ALLOW_DEMO_SEED_DATABASE_ENV] ?? '');
  if (named === '') {
    return { allowed: false, because: 'not-a-demo-name' };
  }
  // Exact and case-sensitive, like Postgres itself: the point is that someone typed this name.
  return name !== '' && named === name
    ? { allowed: true, because: 'named-by-operator' }
    : { allowed: false, because: 'name-mismatch' };
}

const WHAT_THE_SEED_DOES = [
  'The demo seed starts by truncating the domain tables (charges, transactions, documents,',
  'ledger records, businesses, tax categories and more) together with everything that',
  'references them.',
];

const WHERE_THE_TARGET_CAME_FROM = [
  'If POSTGRES_* was not meant to point there, it most likely comes from the repo root .env,',
  'which must only ever hold local credentials. Check it without printing the password:',
  '',
  "  grep -E '^POSTGRES_(HOST|PORT|DB|USER)=' .env",
];

function buildRefusal(
  target: DatabaseTarget,
  because: Extract<DemoSeedTargetVerdict, { allowed: false }>['because'],
  env: NodeJS.ProcessEnv,
  configuredName?: string,
): string {
  const where = describeDatabaseTarget(target);
  // Sanitized like every other displayed field, so a control character cannot reach the terminal.
  const shownName = sanitizeForDisplay(target.db ?? '');
  // Set only when the server reported another database than the one that was configured.
  const mismatch =
    configuredName === undefined
      ? []
      : [
          `(The server reports this connection is on "${shownName}". The configured name was`,
          `"${sanitizeForDisplay(configuredName)}", so something between this command and the server maps one`,
          'name onto the other.)',
          '',
        ];

  if (because === 'production-name') {
    return [
      `Refusing to seed demo data into ${where}: the database name "${shownName}" says production.`,
      '',
      ...mismatch,
      ...WHAT_THE_SEED_DOES,
      `A database whose name carries ${PRODUCTION_DATABASE_WORDS.map(word => `"${word}"`).join(', ')}`,
      'is never reset, on any host, and no variable overrides that.',
      '',
      ...WHERE_THE_TARGET_CAME_FROM,
    ].join('\n');
  }

  const rule = [
    ...WHAT_THE_SEED_DOES,
    'On a remote host it only runs when the database name carries one of these words:',
    `  ${DEMO_DATABASE_WORDS.join(', ')}`,
  ];

  if (because === 'name-mismatch') {
    const named = sanitizeForDisplay(env[ALLOW_DEMO_SEED_DATABASE_ENV] ?? '');
    return [
      `Refusing to seed demo data into ${where}: ${ALLOW_DEMO_SEED_DATABASE_ENV} names "${named}",`,
      `and this command targets "${shownName}".`,
      '',
      ...mismatch,
      ...rule,
      '',
      `${ALLOW_DEMO_SEED_DATABASE_ENV} confirms one other database by its exact name. It does not`,
      'match this one, so either the variable or POSTGRES_* is not what you think it is.',
      '',
      ...WHERE_THE_TARGET_CAME_FROM,
    ].join('\n');
  }

  return [
    `Refusing to seed demo data into ${where}: nothing marks this remote database as a demo`,
    'environment.',
    '',
    ...mismatch,
    ...rule,
    '',
    'For a demo environment whose database is named differently, confirm the reset by naming',
    'that database, for this command only:',
    '',
    `  ${ALLOW_DEMO_SEED_DATABASE_ENV}=<database name> ALLOW_DEMO_SEED=1 yarn seed:staging-demo`,
    '',
    ...WHERE_THE_TARGET_CAME_FROM,
  ].join('\n');
}

/**
 * Throw `DemoSeedRefusedError` unless the demo seed may reset this target. Returns the verdict
 * so the caller can log why a target was accepted.
 *
 * `configuredName` is for the second check only: pass the name that was configured when
 * `target.db` is the name the server reported, so a refusal can say that the two differ.
 */
export function assertDemoSeedTarget(
  target: DatabaseTarget,
  env: NodeJS.ProcessEnv = process.env,
  configuredName?: string,
): Extract<DemoSeedTargetVerdict, { allowed: true }> {
  const verdict = classifyDemoSeedTarget(target, env);
  if (verdict.allowed) {
    return verdict;
  }
  const differs = configuredName !== undefined && configuredName !== databaseName(target);
  throw new DemoSeedRefusedError(
    buildRefusal(target, verdict.because, env, differs ? configuredName : undefined),
  );
}

/** The one client method the reset needs, so a test can pass a plain object. */
export type DemoSeedQueryable = {
  query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }>;
};

/**
 * Clear the tables the demo seed owns, after asking the server which database this is.
 *
 * The configured name was checked before connecting; this checks the connection itself. They
 * can differ: a pooler or proxy maps a client-side name onto another database, and a tunnel
 * puts a deployed server behind `localhost`. `current_database()` is answered by the server
 * and is not subject to row security, so it is the last word on what is about to be emptied.
 *
 * The seed runs this outside a transaction, so the TRUNCATE is committed the moment it
 * returns, and row security does not limit it to one tenant. Nothing after this point can undo
 * it, which is why nothing before it may be skipped.
 */
export async function resetDemoSeedTables(
  client: DemoSeedQueryable,
  target: DatabaseTarget,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const { rows } = await client.query('SELECT current_database() AS database');
  const connected = rows[0]?.['database'];
  if (typeof connected !== 'string' || connected === '') {
    throw new DemoSeedRefusedError(
      'Refusing to reset: the server did not say which database this connection is on, so there ' +
        'is nothing to check the demo seed target against.',
    );
  }

  assertDemoSeedTarget({ ...target, db: connected }, env, databaseName(target));

  await client.query(
    `TRUNCATE TABLE ${DEMO_SEED_TABLES.map(table => `accounter_schema.${table}`).join(', ')} ` +
      'RESTART IDENTITY CASCADE',
  );
}
