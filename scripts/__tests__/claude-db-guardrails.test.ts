import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PER_COMMAND_OPT_INS } from '../../packages/migrations/src/local-db-guard.js';

/**
 * `.claude/settings.json` is what every Claude Code session in this repo starts with. Three
 * things in it are there so that an agent is never what points a command at a deployed
 * database:
 *
 * - `ENFORCE_LOCAL_DB=1` in every session's environment, so `migration:run` refuses a
 *   non-local database instead of warning;
 * - no reading of `.env` files, which is where a deployed database's credentials would be;
 * - a hook that makes a person confirm any command that sets a per-command opt-in.
 *
 * These tests keep the three in place and run the hook script itself. Nothing here connects
 * to anything: the hook is a pure function of the text it is handed.
 */

const repoRoot = join(import.meta.dirname, '../..');
const HOOK = '.claude/hooks/ask-before-db-opt-in.mjs';

type Settings = {
  env?: Record<string, string>;
  permissions: { allow: string[]; deny: string[]; ask?: string[] };
  hooks: Record<
    string,
    Array<{ matcher?: string; hooks: Array<{ type: string; command?: string }> }>
  >;
};
const settings = JSON.parse(
  readFileSync(join(repoRoot, '.claude/settings.json'), 'utf8'),
) as Settings;

function runHook(stdin: string): { status: number | null; stdout: string } {
  const result = spawnSync(process.execPath, [join(repoRoot, HOOK)], {
    input: stdin,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout };
}

/** What the hook answers for one Bash command, or undefined when it says nothing. */
function decisionFor(
  command: string,
): { permissionDecision: string; permissionDecisionReason: string } | undefined {
  const { status, stdout } = runHook(
    JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
  );
  expect(status, command).toBe(0);
  if (stdout === '') return undefined;
  const { hookSpecificOutput } = JSON.parse(stdout) as {
    hookSpecificOutput: {
      hookEventName: string;
      permissionDecision: string;
      permissionDecisionReason: string;
    };
  };
  expect(hookSpecificOutput.hookEventName).toBe('PreToolUse');
  return hookSpecificOutput;
}

describe('.claude/settings.json database guardrails', () => {
  it('puts ENFORCE_LOCAL_DB=1 in every session', () => {
    expect(settings.env?.['ENFORCE_LOCAL_DB']).toBe('1');
  });

  it('denies reading every env file it denies editing', () => {
    const { deny } = settings.permissions;
    const notEditable = deny
      .filter(rule => /^Edit\(.*\.env/.test(rule))
      .map(rule => rule.slice('Edit('.length, -1));

    expect(notEditable).toContain('**/.env');
    for (const path of notEditable) {
      expect(deny, path).toContain(`Read(${path})`);
    }
  });

  it('leaves the env templates readable', () => {
    const readDenied = settings.permissions.deny
      .filter(rule => rule.startsWith('Read('))
      .map(rule => rule.slice('Read('.length, -1));

    // The rules name files. A catch-all such as `.env*` or `.env.*` would take the templates
    // with it, and those are what a session is meant to read instead.
    for (const path of readDenied) {
      expect(path).not.toMatch(/\.env\.?\*$/);
      expect(path).not.toMatch(/\.env\.(template|example)$/);
    }
  });

  it('runs the opt-in hook before every Bash call', () => {
    const forBash = (settings.hooks['PreToolUse'] ?? []).filter(entry => entry.matcher === 'Bash');
    const commands = forBash.flatMap(entry => entry.hooks).map(hook => hook.command ?? '');

    expect(commands.some(command => command.includes(HOOK))).toBe(true);
  });

  it('allows no command that would take the opt-ins for granted', () => {
    // An allow rule that names an opt-in would approve the command before anyone is asked.
    for (const rule of settings.permissions.allow) {
      for (const name of PER_COMMAND_OPT_INS) {
        expect(rule).not.toContain(name);
      }
    }
  });
});

describe('ask-before-db-opt-in hook', () => {
  it.each(PER_COMMAND_OPT_INS)('asks before a command that sets %s', name => {
    const commands = [
      `${name}=1 yarn test`,
      `POSTGRES_HOST=db.example.invalid ${name}=accounter yarn seed:staging-demo`,
      `export ${name}=1`,
      `env ${name}=1 yarn vitest run`,
      `cd packages/server && ${name}=1 yarn test`,
      `echo start; ${name}="1" node scripts/x.js`,
      `yarn build &&\n${name}=1 yarn seed:production`,
    ];

    for (const command of commands) {
      const decision = decisionFor(command);

      expect(decision?.permissionDecision, command).toBe('ask');
      expect(decision?.permissionDecisionReason, command).toContain(`sets ${name}.`);
    }
  });

  it('names every opt-in a command sets, each under its own name', () => {
    const decision = decisionFor(
      'ALLOW_DEMO_SEED_DATABASE=accounter_uat ALLOW_REMOTE_DB=1 ALLOW_DEMO_SEED=1 yarn seed:staging-demo',
    );

    expect(decision?.permissionDecisionReason).toContain(
      'sets ALLOW_REMOTE_DB and ALLOW_DEMO_SEED and ALLOW_DEMO_SEED_DATABASE.',
    );
    // The longer name is not also counted as the shorter one it starts with.
    expect(
      decisionFor('ALLOW_DEMO_SEED_DATABASE=accounter_uat true')?.permissionDecisionReason,
    ).toContain('sets ALLOW_DEMO_SEED_DATABASE. That is a per-command database opt-in');
  });

  it('says nothing for a command that sets none', () => {
    const commands = [
      'yarn test',
      'ENFORCE_LOCAL_DB=1 yarn workspace @accounter-helper/migrations migration:run',
      'POSTGRES_HOST=localhost POSTGRES_PORT=5432 yarn vitest run --project unit',
      'echo "$ALLOW_REMOTE_DB"',
      'git grep -n ALLOW_DEMO_SEED',
      'XALLOW_REMOTE_DB=1 true',
      'ALLOW_REMOTE_DBX=1 true',
      'MY_ALLOW_DEMO_SEED=1 true',
    ];

    for (const command of commands) {
      expect(decisionFor(command), command).toBeUndefined();
    }
  });

  it('stays silent and exits 0 on input it does not understand', () => {
    for (const stdin of [
      '',
      'not json',
      '[]',
      '{}',
      '{"tool_input":{}}',
      '{"tool_input":{"command":42}}',
    ]) {
      expect(runHook(stdin), JSON.stringify(stdin)).toEqual({ status: 0, stdout: '' });
    }
  });
});
