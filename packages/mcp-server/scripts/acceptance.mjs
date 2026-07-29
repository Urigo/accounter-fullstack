#!/usr/bin/env node
/**
 * Final acceptance gate for @accounter/mcp-server (blueprint Prompt 24).
 *
 * Runs, in order: lint → typecheck → build → the package test suite (unit +
 * end-to-end integration + smoke checks, all service-free in the `unit`
 * project). Exits non-zero on the first failing step.
 */
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgDir, '..', '..');

const vitestBin = resolve(repoRoot, 'node_modules/.bin/vitest');

/** @type {Array<[label: string, cmd: string, cwd: string]>} */
const steps = [
  ['lint', 'yarn lint', pkgDir],
  ['typecheck', 'yarn typecheck', pkgDir],
  ['build', 'yarn build', pkgDir],
  [
    'unit + integration + smoke tests',
    `"${vitestBin}" run --project unit packages/mcp-server`,
    repoRoot,
  ],
];

for (const [label, cmd, cwd] of steps) {
  console.log(`\n── acceptance: ${label} ──`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
  } catch {
    console.error(`\n❌ acceptance failed at: ${label}`);
    process.exit(1);
  }
}

console.log('\n✅ mcp-server acceptance passed — ready for controlled rollout.');
