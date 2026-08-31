/* eslint-disable no-undef */

/* eslint-disable no-console */

/**
 * Wrapper around `changeset publish` for CI.
 *
 * `@changesets/cli` v3 dropped the `🦋  New tag: <pkg>@<version>` lines from the publish
 * output, but `dotansimha/changesets-action` still parses exactly those lines to know which
 * packages were released (and therefore which GitHub releases to create). Instead of parsing
 * the new human-facing output, we ask the CLI for a machine-readable report via
 * `CHANGESETS_OUTPUT` (NDJSON, one event per created git tag) and re-emit the legacy lines.
 *
 * Remove this wrapper once the release action understands the v3 output.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const reportPath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'changesets-publish-')),
  'report.ndjson',
);

const child = spawn(
  process.execPath,
  ['node_modules/@changesets/cli/bin.js', 'publish', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, CHANGESETS_OUTPUT: reportPath },
  },
);

let spawnFailed = false;

child.on('error', error => {
  spawnFailed = true;
  console.error(`Failed to run 'changeset publish': ${error.message}`);
});

child.on('close', code => {
  const succeeded = !spawnFailed && code === 0;
  if (succeeded) {
    for (const event of readReport()) {
      if (event.type === 'git-tag' && event.tag) {
        console.log(`New tag: ${event.tag}`);
      }
    }
  }
  // Not `process.exit()`: that can truncate the lines above when stdout is a pipe (as it is in
  // CI, where the release action reads them). A `null`/negative code means the child was killed
  // by a signal or never started, so report a plain failure.
  process.exitCode = succeeded ? 0 : code > 0 ? code : 1;
});

function readReport() {
  if (!fs.existsSync(reportPath)) {
    return [];
  }
  return fs
    .readFileSync(reportPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try {
        const parsed = JSON.parse(line);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    });
}
