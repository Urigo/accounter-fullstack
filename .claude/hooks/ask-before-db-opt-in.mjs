#!/usr/bin/env node
// PreToolUse hook for every tool that runs a shell command in a Claude Code session
// (.claude/settings.json): Bash, PowerShell, Monitor and the desktop app's terminal tool. Each
// one hands over its command line as `tool_input.command`.
//
// ALLOW_REMOTE_DB, ALLOW_DEMO_SEED and ALLOW_DEMO_SEED_DATABASE are per-command opt-ins: each
// one lets a command reach a database that is not local, or reset the database it reaches, and
// each one means "the person running this command chose to". An agent typing one into a command
// is not that person. So when a command sets any of them, this hook answers "ask" and the call
// waits for a person to confirm it. Where nobody can be asked, as in `claude -p` or `dontAsk`
// mode, Claude Code refuses the call instead.
//
// A hook rather than an `ask` permission rule: Bash rules are documented to match past a
// leading `NAME=value` assignment, and that assignment is the thing to catch here. A hook is
// handed the whole command text.
//
// It errs towards asking: a command that only mentions `ALLOW_REMOTE_DB=1` inside a string
// (a commit message, a grep pattern) is asked about too. It never blocks anything by itself,
// and it stays silent, exit 0, on any input it does not understand.
//
// The list has to match PER_COMMAND_OPT_INS in packages/migrations/src/local-db-guard.ts.
// scripts/__tests__/claude-db-guardrails.test.ts fails when the two drift apart.
import { readFileSync } from 'node:fs';

const OPT_INS = ['ALLOW_REMOTE_DB', 'ALLOW_DEMO_SEED', 'ALLOW_DEMO_SEED_DATABASE'];

function commandFromPayload() {
  try {
    const payload = JSON.parse(readFileSync(0, 'utf8'));
    const command = payload?.tool_input?.command;
    return typeof command === 'string' ? command : '';
  } catch {
    return '';
  }
}

const command = commandFromPayload();
// `NAME=` with no identifier character in front, so ALLOW_DEMO_SEED= is not also read as a match
// inside XALLOW_DEMO_SEED=, and ALLOW_DEMO_SEED_DATABASE= is reported under its own name only.
const found = OPT_INS.filter(name => new RegExp(`(?<![A-Za-z0-9_])${name}=`).test(command));

if (found.length > 0) {
  const names = found.join(' and ');
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason:
          `This command sets ${names}. ` +
          (found.length === 1
            ? 'That is a per-command database opt-in'
            : 'Those are per-command database opt-ins') +
          ': with it a command may reach a database that is not local, or reset the one it reaches. ' +
          "It is a person's decision for this one command, so it is asked every time. " +
          'See "Database safety" in README.md.',
      },
    }),
  );
}
