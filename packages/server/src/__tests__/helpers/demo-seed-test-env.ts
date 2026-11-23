import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { assertLocalDatabaseOnly } from '../../../../migrations/src/local-db-guard.js';

/**
 * Environment for the two processes `demo-fixtures/__tests__/seed-and-validate.test.ts` starts
 * (the demo seed, then its validator).
 *
 * That test is the one caller that runs the demo seed without a person typing the command. It
 * used to add `ALLOW_DEMO_SEED=1` to the seed's environment itself, so whatever collected the
 * test also opted the database behind `POSTGRES_*` into a reset: a plain `yarn test` picked up
 * a copy of it from a nested git worktree, and the root `.env` decided what got truncated. So
 * the test is held to a stricter rule than the script:
 *
 * - the target must be local, with no override (`ALLOW_REMOTE_DB` is not consulted);
 * - `ALLOW_DEMO_SEED=1` must already be in the environment. The test passes the environment
 *   through and never adds the opt-in.
 *
 * Throws when either does not hold. `workspaceRoot` is the directory the test uses as the
 * children's cwd.
 */
export function resolveDemoSeedTestEnv(
  workspaceRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  // The seed script calls dotenv's `config()` from `workspaceRoot`, which fills in whatever the
  // environment does not already set. Apply the same file the same way, into a copy, so the
  // host judged below is the one the child would resolve -- including when POSTGRES_HOST is
  // absent here and would only appear once the child reads `.env`.
  const childEnv: NodeJS.ProcessEnv = { ...env };
  loadDotenv({
    path: resolve(workspaceRoot, '.env'),
    processEnv: childEnv as Record<string, string>,
    quiet: true,
  });

  // node-postgres falls back to PGHOST, then to localhost, when no host is configured.
  const host = childEnv['POSTGRES_HOST'] || childEnv['PGHOST'] || 'localhost';
  assertLocalDatabaseOnly(
    {
      host,
      port: childEnv['POSTGRES_PORT'],
      db: childEnv['POSTGRES_DB'],
      user: childEnv['POSTGRES_USER'],
    },
    'the demo seed test',
  );

  if (childEnv['ALLOW_DEMO_SEED'] !== '1') {
    throw new Error(
      [
        'The demo seed test needs ALLOW_DEMO_SEED=1 on the command:',
        '',
        '  ALLOW_DEMO_SEED=1 yarn test:demo-seed',
        '',
        'It resets the database it is pointed at, so the opt-in has to come from whoever runs',
        'it. The test passes the environment through and never sets the variable itself.',
      ].join('\n'),
    );
  }

  // Pin the host that was just judged. dotenv never overrides a variable that is already set,
  // so no .env file the child loads on its own can move it to another host afterwards.
  childEnv['POSTGRES_HOST'] = host;
  return childEnv;
}
