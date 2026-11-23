import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import {
  ALLOW_REMOTE_DB_ENV,
  assertLocalDatabaseOnly,
  assertOptInsNotInEnvFile,
} from '../../../../migrations/src/local-db-guard.js';

/**
 * Environment for the two processes `demo-fixtures/__tests__/seed-and-validate.test.ts` starts
 * (the demo seed, then its validator).
 *
 * That test is the one caller that runs the demo seed without a person typing the command, so
 * it is held to a stricter rule than the script, and the rule is checked here, before anything
 * is started:
 *
 * - The target must be local, and nothing overrides that. The script accepts a remote host
 *   with `ALLOW_REMOTE_DB=1`; this does not consult the variable, and takes it out of what the
 *   children get, so the script's own guard is left with no way to accept one either.
 * - The target judged is the one the children would resolve, the `.env` in their cwd included.
 * - No opt-in is taken from that `.env`.
 *
 * The check does not lean on the script refusing. The script's guard answers to the staging
 * deploy as well, and it has been relaxed for a deploy before; this one has a single caller
 * that never has a reason to leave the machine.
 *
 * `ALLOW_DEMO_SEED=1` is not decided here: the test is skipped without it, the script refuses
 * without it, and this function passes the caller's environment through without adding it.
 *
 * Throws when the rule does not hold. `workspaceRoot` is the directory the test uses as the
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
  const envFile = resolve(workspaceRoot, '.env');
  const loaded = loadDotenv({
    path: envFile,
    processEnv: childEnv as Record<string, string>,
    quiet: true,
  });

  // An opt-in is typed for one command. One that sits in the file is refused, as the script
  // refuses it, instead of being handed to the children as if the caller had set it.
  assertOptInsNotInEnvFile(loaded.parsed, envFile);

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
    childEnv,
  );

  // The children never get the remote-database opt-in, whatever the caller exported.
  delete childEnv[ALLOW_REMOTE_DB_ENV];

  // Pin the host that was just judged. dotenv never overrides a variable that is already set,
  // so no .env file the child loads on its own can move it to another host afterwards.
  childEnv['POSTGRES_HOST'] = host;
  return childEnv;
}
