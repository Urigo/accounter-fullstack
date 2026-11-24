import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PER_COMMAND_OPT_INS } from '../../packages/migrations/src/local-db-guard.js';

/**
 * `.claude/settings.json` is what every Claude Code session in this repo starts with. Three
 * things in it are there so that an agent is never what points a command at a deployed
 * database:
 *
 * - `ENFORCE_LOCAL_DB=1` in every session's environment, so `migration:run` refuses a
 *   non-local database instead of warning;
 * - no reading of env files, which is where a deployed database's credentials would be;
 * - a hook that makes a person confirm any command that sets a per-command opt-in.
 *
 * These tests keep the three in place and run the hook script itself. Nothing here connects
 * to anything: the hook is a pure function of the text it is handed.
 */

const repoRoot = join(import.meta.dirname, '../..');
const HOOK = '.claude/hooks/ask-before-db-opt-in.mjs';

/** Every tool that runs a shell command. Each passes it as `tool_input.command`. */
const SHELL_TOOLS = ['Bash', 'PowerShell', 'Monitor', 'mcp__terminal__run_in_terminal'];

/** The names an env file with real credentials usually has. */
const USUAL_ENV_FILE_NAMES = [
  '.env',
  '.env.local',
  '.env.*.local',
  '.env.test',
  '.env.development',
  '.env.staging',
  '.env.production',
  '.dev.vars',
];

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

/** What the hook answers for one command, or undefined when it says nothing. */
function decisionFor(
  command: string,
  toolName = 'Bash',
): { permissionDecision: string; permissionDecisionReason: string } | undefined {
  const { status, stdout } = runHook(
    JSON.stringify({ tool_name: toolName, tool_input: { command } }),
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

/** The env file paths one file tool is denied, in the order the settings file lists them. */
function deniedPaths(tool: 'Read' | 'Edit'): string[] {
  return settings.permissions.deny
    .filter(rule => rule.startsWith(`${tool}(`))
    .map(rule => rule.slice(tool.length + 1, -1))
    .filter(path => /(^|\/)!?\.(env|dev\.vars)/.test(path));
}

/** A file name pattern whose only wildcard is `*`, as a test on a file's base name. */
function nameMatcher(pattern: string): RegExp {
  const literal = pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${literal.join('[^/]*')}$`);
}

const ANYWHERE = '//**/';

// Whether the Read rules deny a file of this name, by the matching the Claude Code docs
// describe (https://code.claude.com/docs/en/permissions, "Read and Edit"):
//
// - a rule that starts with `//` is anchored at the filesystem root, so it matches the name
//   wherever the file is;
// - a bare name matches at any depth, but only at or under the session's directory;
// - `!name` carves its matches out of the bare rules listed before it. It cannot reach a
//   `//` rule.
function readDenied(fileName: string, where: 'in the session directory' | 'elsewhere'): boolean {
  let deniedByBareRule = false;
  for (const path of deniedPaths('Read')) {
    if (path.startsWith(ANYWHERE)) {
      if (nameMatcher(path.slice(ANYWHERE.length)).test(fileName)) return true;
    } else if (where === 'elsewhere') {
      continue;
    } else if (path.startsWith('!')) {
      if (nameMatcher(path.slice(1)).test(fileName)) deniedByBareRule = false;
    } else if (nameMatcher(path).test(fileName)) {
      deniedByBareRule = true;
    }
  }
  return deniedByBareRule;
}

describe('.claude/settings.json database guardrails', () => {
  it('puts ENFORCE_LOCAL_DB=1 in every session', () => {
    expect(settings.env?.['ENFORCE_LOCAL_DB']).toBe('1');
  });

  it('denies editing and reading the same env files', () => {
    expect(deniedPaths('Read')).toEqual(deniedPaths('Edit'));
  });

  it('only uses the rule shapes that readDenied above understands', () => {
    for (const path of deniedPaths('Read')) {
      expect(path.startsWith(ANYWHERE) ? path.slice(ANYWHERE.length) : path, path).toMatch(
        /^!?[^/!]+$/,
      );
    }
  });

  // A bare rule stops at the session's directory. A session in a git worktree has the main
  // checkout's `.env`, the one that holds real credentials, above its own directory.
  it.each(USUAL_ENV_FILE_NAMES)('denies %s anywhere on the machine', name => {
    expect(deniedPaths('Read')).toContain(`${ANYWHERE}${name}`);
  });

  it.each(['.env', '.env.local', '.env.development.local', '.env.production', '.dev.vars'])(
    'denies reading %s in the session directory and outside it',
    fileName => {
      expect(readDenied(fileName, 'in the session directory')).toBe(true);
      expect(readDenied(fileName, 'elsewhere')).toBe(true);
    },
  );

  // `.gitignore` ignores `.env*`, so credentials can sit under any such name, a per-target
  // copy kept next to `.env` for one. Only a catch-all covers those names, and it has to be a
  // bare rule, because the templates are carved back out of it.
  it.each(['.env.azure', '.env.production.bak', '.envrc', '.dev.vars.staging'])(
    'denies reading %s in the session directory',
    fileName => {
      expect(readDenied(fileName, 'in the session directory')).toBe(true);
    },
  );

  it('leaves every tracked env file, the templates, readable', () => {
    const listed = spawnSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' });
    expect(listed.status).toBe(0);
    const tracked = listed.stdout
      .split('\n')
      .filter(file => /^\.(env|dev\.vars)/.test(basename(file)));

    // `.env.template` in the root and in the packages, and the gateway's `.dev.vars.example`.
    expect(tracked).toContain('.env.template');
    expect(tracked).toContain('packages/email-ingestion-gateway/.dev.vars.example');
    for (const file of tracked) {
      expect(readDenied(basename(file), 'in the session directory'), file).toBe(false);
      expect(readDenied(basename(file), 'elsewhere'), file).toBe(false);
    }
    // No package has one today, but the allow list already treats it as a template.
    expect(readDenied('.env.example', 'in the session directory')).toBe(false);
  });

  it('runs the opt-in hook before every tool that runs a shell command', () => {
    const entries = (settings.hooks['PreToolUse'] ?? []).filter(entry =>
      entry.hooks.some(hook => hook.command?.includes(HOOK)),
    );
    expect(entries).toHaveLength(1);

    // Tool names joined by `|` are matched as exact names. Any other character would make the
    // matcher a regular expression.
    const matcher = entries[0]?.matcher ?? '';
    expect(matcher).toMatch(/^\w+(\|\w+)*$/);
    for (const tool of SHELL_TOOLS) {
      expect(matcher.split('|'), tool).toContain(tool);
    }
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

  it.each(SHELL_TOOLS)('answers the same when %s sends the command', toolName => {
    expect(
      decisionFor('ALLOW_REMOTE_DB=1 yarn seed:staging-demo', toolName)?.permissionDecision,
    ).toBe('ask');
    expect(decisionFor('yarn seed:staging-demo', toolName)).toBeUndefined();
  });

  it('says nothing for a Monitor call that opens a WebSocket and runs no command', () => {
    const stdin = JSON.stringify({
      tool_name: 'Monitor',
      tool_input: { ws: { url: 'wss://events.example.invalid/stream' }, description: 'events' },
    });

    expect(runHook(stdin)).toEqual({ status: 0, stdout: '' });
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
