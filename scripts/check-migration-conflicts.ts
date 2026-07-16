#!/usr/bin/env node
/**
 * CI Migration Conflict Detection Script
 *
 * Detects conflicts where parallel branches touch the same DB functions in migrations.
 * Also fails if a PR edits existing migration files instead of adding a new one.
 *
 * Usage:
 *   node --import ./scripts/register-esm.js ./scripts/check-migration-conflicts.ts
 *
 * Optional env vars:
 *   MIGRATION_CONFLICT_BASE_REF (default: origin/main)
 *   MIGRATION_CONFLICT_HEAD_REF (default: HEAD)
 *   MIGRATION_CONFLICT_WARN_ONLY=1 (prints errors but exits 0)
 *
 * Optional args:
 *   --base-ref <git-ref-or-sha>
 *   --head-ref <git-ref-or-sha>
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const MIGRATIONS_DIR = 'packages/migrations/src/actions';

type Ref = {
  schema?: string;
  name: string;
  key: string;
  bareKey: string;
};

type ParsedChange = {
  status: string;
  path: string;
  oldPath?: string;
};

type MigrationAnalysis = {
  path: string;
  refs: Ref[];
  allowReasonsByKey: Map<string, string>;
};

type Conflict = {
  kind: 'pr-vs-base' | 'pr-vs-base-history' | 'pr-internal';
  leftPath: string;
  rightPath: string;
  functionName: string;
  allowed: boolean;
  allowReason?: string;
};

type CliArgs = {
  baseRef?: string;
  headRef?: string;
};

function runGit(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--base-ref' && next) {
      parsed.baseRef = next;
      index += 1;
      continue;
    }

    if (arg === '--head-ref' && next) {
      parsed.headRef = next;
      index += 1;
    }
  }

  return parsed;
}

function parseNameStatus(output: string): ParsedChange[] {
  if (!output) {
    return [];
  }

  const rows = output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const changes: ParsedChange[] = [];

  for (const row of rows) {
    const parts = row.split('\t');
    const status = parts[0] ?? '';

    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = parts[1];
      const newPath = parts[2];

      if (!newPath) {
        continue;
      }

      changes.push({
        status,
        path: newPath,
        oldPath,
      });
      continue;
    }

    const filePath = parts[1];

    if (!filePath) {
      continue;
    }

    changes.push({
      status,
      path: filePath,
    });
  }

  return changes;
}

function normalizeIdentifierPart(part: string): string {
  return part
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function parseRef(identifier: string): Ref | null {
  const cleaned = identifier.trim();
  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split('.').map(normalizeIdentifierPart).filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const name = parts[parts.length - 1];
  const schema = parts.length > 1 ? parts[parts.length - 2] : undefined;

  return {
    schema,
    name,
    key: schema ? `${schema}.${name}` : name,
    bareKey: name,
  };
}

function dedupeRefs(refs: Ref[]): Ref[] {
  const byKey = new Map<string, Ref>();

  for (const ref of refs) {
    const stableKey = `${ref.key}|${ref.bareKey}`;
    if (!byKey.has(stableKey)) {
      byKey.set(stableKey, ref);
    }
  }

  return [...byKey.values()];
}

function extractRefs(content: string): Ref[] {
  const refs: Ref[] = [];

  const functionPatterns = [
    /\bcreate\s+(?:or\s+replace\s+)?function\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s*\(/gim,
    /\balter\s+function\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s*\(/gim,
    /\bdrop\s+function\s+(?:if\s+exists\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s*\(/gim,
  ];

  for (const pattern of functionPatterns) {
    let match = pattern.exec(content);

    while (match) {
      const identifier = match[1];
      if (identifier) {
        const ref = parseRef(identifier);
        if (ref) {
          refs.push(ref);
        }
      }

      match = pattern.exec(content);
    }
  }

  return dedupeRefs(refs);
}

function extractAllowReasonsByKey(content: string): Map<string, string> {
  const allowReasonsByKey = new Map<string, string>();
  const allowRegex = /migration-conflict-allow:\s*([^\n]+?)\s+because\s+([^\n]+)/gim;

  let match = allowRegex.exec(content);
  while (match) {
    const identifier = match[1]?.trim();
    const reason = match[2]?.trim();

    if (identifier && reason) {
      const ref = parseRef(identifier);
      if (ref) {
        allowReasonsByKey.set(ref.key, reason);
        allowReasonsByKey.set(ref.bareKey, reason);
      }
    }

    match = allowRegex.exec(content);
  }

  return allowReasonsByKey;
}

function analyzeMigrations(paths: string[]): MigrationAnalysis[] {
  return paths.map(path => {
    const content = readFileSync(path, 'utf8');

    return {
      path,
      refs: extractRefs(content),
      allowReasonsByKey: extractAllowReasonsByKey(content),
    };
  });
}

function listMigrationPathsAtRef(ref: string): string[] {
  const output = runGit(['ls-tree', '-r', '--name-only', ref, '--', MIGRATIONS_DIR]);

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map(line => line.trim())
    .filter(path => path.endsWith('.ts'))
    .sort();
}

function readFileAtRef(ref: string, path: string): string {
  return runGit(['show', `${ref}:${path}`]);
}

function analyzeMigrationsFromBasePreferringLocal(args: {
  ref: string;
  paths: string[];
  forceReadFromRefPaths?: Set<string>;
}): MigrationAnalysis[] {
  const analysis: MigrationAnalysis[] = [];

  for (const path of args.paths) {
    const shouldReadFromRef = args.forceReadFromRefPaths?.has(path) || !existsSync(path);
    const content = shouldReadFromRef ? readFileAtRef(args.ref, path) : readFileSync(path, 'utf8');

    analysis.push({
      path,
      refs: extractRefs(content),
      allowReasonsByKey: extractAllowReasonsByKey(content),
    });
  }

  return analysis;
}

function refsOverlap(left: Ref, right: Ref): boolean {
  if (left.name !== right.name) {
    return false;
  }

  return !left.schema || !right.schema || left.schema === right.schema;
}

function displayRef(left: Ref, right: Ref): string {
  if (left.schema && right.schema && left.schema === right.schema) {
    return `${left.schema}.${left.name}`;
  }

  return left.name;
}

function detectConflicts(args: {
  kind: Conflict['kind'];
  left: MigrationAnalysis[];
  right: MigrationAnalysis[];
  rightIsBaseSide: boolean;
}): Conflict[] {
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();

  for (const leftMigration of args.left) {
    for (const rightMigration of args.right) {
      if (leftMigration.path === rightMigration.path) {
        continue;
      }

      for (const leftRef of leftMigration.refs) {
        for (const rightRef of rightMigration.refs) {
          if (!refsOverlap(leftRef, rightRef)) {
            continue;
          }

          const functionName = displayRef(leftRef, rightRef);
          const dedupeKey = `${args.kind}|${leftMigration.path}|${rightMigration.path}|${functionName}`;

          if (seen.has(dedupeKey)) {
            continue;
          }

          seen.add(dedupeKey);

          let allowReason: string | undefined;
          if (args.rightIsBaseSide) {
            allowReason =
              leftMigration.allowReasonsByKey.get(leftRef.key) ||
              leftMigration.allowReasonsByKey.get(leftRef.bareKey);
          } else {
            allowReason =
              rightMigration.allowReasonsByKey.get(rightRef.key) ||
              rightMigration.allowReasonsByKey.get(rightRef.bareKey) ||
              leftMigration.allowReasonsByKey.get(leftRef.key) ||
              leftMigration.allowReasonsByKey.get(leftRef.bareKey);
          }

          conflicts.push({
            kind: args.kind,
            leftPath: leftMigration.path,
            rightPath: rightMigration.path,
            functionName,
            allowed: !!allowReason,
            allowReason,
          });
        }
      }
    }
  }

  return conflicts;
}

function formatPaths(paths: string[]): string {
  return paths.map(path => `  - ${path}`).join('\n');
}

function appendStepSummary(lines: string[]): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (!summaryPath) {
    return;
  }

  appendFileSync(summaryPath, `${lines.join('\n')}\n`, { encoding: 'utf8' });
}

function formatConflictSummaryLine(conflict: Conflict): string {
  const reason = conflict.allowReason ? ` | reason: ${conflict.allowReason}` : '';
  return `- ${conflict.kind}: ${conflict.functionName} | ${conflict.leftPath} <> ${conflict.rightPath}${reason}`;
}

function formatChangedMigrationLine(change: ParsedChange): string {
  if (change.oldPath) {
    return `- ${change.oldPath} -> ${change.path} (${change.status})`;
  }

  return `- ${change.path} (${change.status})`;
}

function getBaseAndHeadRefs(): { baseRef: string; headRef: string } {
  const cli = parseArgs(process.argv.slice(2));
  const baseRef = cli.baseRef || process.env.MIGRATION_CONFLICT_BASE_REF || 'origin/main';
  const headRef = cli.headRef || process.env.MIGRATION_CONFLICT_HEAD_REF || 'HEAD';

  return { baseRef, headRef };
}

function getDiffChanges(args: { fromRef: string; toRef: string }): ParsedChange[] {
  const output = runGit([
    'diff',
    '--name-status',
    '--find-renames',
    `${args.fromRef}..${args.toRef}`,
    '--',
    MIGRATIONS_DIR,
  ]);

  return parseNameStatus(output).filter(change => change.path.endsWith('.ts'));
}

function main() {
  const { baseRef, headRef } = getBaseAndHeadRefs();

  let mergeBase = '';
  try {
    mergeBase = runGit(['merge-base', baseRef, headRef]);
  } catch (error) {
    appendStepSummary([
      '## Migration conflict check',
      '',
      'Result: FAILED',
      '',
      `- base ref: ${baseRef}`,
      `- head ref: ${headRef}`,
      '- failed to compute merge-base (ensure fetch-depth: 0 in CI checkout)',
    ]);

    console.error(`ERROR: Failed to compute merge-base between ${baseRef} and ${headRef}.`);
    console.error('Ensure git history is available (for CI use checkout fetch-depth: 0).');
    console.error(error);
    process.exit(1);
  }

  const prChanges = getDiffChanges({ fromRef: mergeBase, toRef: headRef });
  if (prChanges.length === 0) {
    appendStepSummary([
      '## Migration conflict check',
      '',
      'Result: PASSED',
      '',
      `- base ref: ${baseRef}`,
      `- head ref: ${headRef}`,
      `- merge-base: ${mergeBase}`,
      '- no migration changes in this PR',
    ]);

    console.log(`OK: No migration changes under ${MIGRATIONS_DIR}.`);
    process.exit(0);
  }

  const modifiedExistingInPr = prChanges.filter(change => change.status !== 'A');
  const modifiedExistingMigrationPaths = new Set<string>();

  for (const change of modifiedExistingInPr) {
    modifiedExistingMigrationPaths.add(change.path);
    if (change.oldPath) {
      modifiedExistingMigrationPaths.add(change.oldPath);
    }
  }

  const prAddedMigrationPaths = prChanges
    .filter(change => change.status === 'A')
    .map(change => change.path)
    .sort();

  const baseChanges = getDiffChanges({ fromRef: mergeBase, toRef: baseRef });
  const baseAddedMigrationPaths = baseChanges
    .filter(change => change.status === 'A')
    .map(change => change.path)
    .sort();
  const baseAddedMigrationPathSet = new Set(baseAddedMigrationPaths);

  const baseHistoryMigrationPaths = listMigrationPathsAtRef(baseRef).filter(
    path => !baseAddedMigrationPathSet.has(path),
  );

  const errors: string[] = [];

  if (modifiedExistingInPr.length > 0) {
    errors.push('Editing existing migration files is forbidden. Add a new migration instead.');
    errors.push(
      formatPaths(
        modifiedExistingInPr.map(change =>
          change.oldPath
            ? `${change.oldPath} -> ${change.path} (${change.status})`
            : `${change.path} (${change.status})`,
        ),
      ),
    );
  }

  const prAnalysis = analyzeMigrations(prAddedMigrationPaths);
  const baseAnalysis = analyzeMigrations(baseAddedMigrationPaths);
  const baseHistoryAnalysis = analyzeMigrationsFromBasePreferringLocal({
    ref: baseRef,
    paths: baseHistoryMigrationPaths,
    forceReadFromRefPaths: modifiedExistingMigrationPaths,
  });

  const prVsBaseConflicts = detectConflicts({
    kind: 'pr-vs-base',
    left: prAnalysis,
    right: baseAnalysis,
    rightIsBaseSide: true,
  });

  const prVsBaseHistoryConflicts = detectConflicts({
    kind: 'pr-vs-base-history',
    left: prAnalysis,
    right: baseHistoryAnalysis,
    rightIsBaseSide: true,
  });

  const prInternalConflicts = detectConflicts({
    kind: 'pr-internal',
    left: prAnalysis,
    right: prAnalysis,
    rightIsBaseSide: false,
  }).filter(conflict => conflict.leftPath < conflict.rightPath);

  const allConflicts = [...prVsBaseConflicts, ...prVsBaseHistoryConflicts, ...prInternalConflicts];

  const blockingConflicts = allConflicts.filter(conflict => !conflict.allowed);
  const allowedConflicts = allConflicts.filter(conflict => conflict.allowed);

  if (blockingConflicts.length > 0) {
    errors.push('Detected migration conflicts on DB function updates:');
    for (const conflict of blockingConflicts) {
      errors.push(
        `  - ${conflict.kind}: ${conflict.functionName} | ${conflict.leftPath} <> ${conflict.rightPath}`,
      );
    }
    errors.push(
      'If this override is intentional, add a comment in the PR migration file: migration-conflict-allow: <schema.function_name> because <reason>.',
    );
  }

  if (allowedConflicts.length > 0) {
    console.log('WARN: Allowed migration conflicts detected:');
    for (const conflict of allowedConflicts) {
      console.log(
        `  - ${conflict.kind}: ${conflict.functionName} | ${conflict.leftPath} <> ${conflict.rightPath} | reason: ${conflict.allowReason}`,
      );
    }
  }

  const warnOnly = process.env.MIGRATION_CONFLICT_WARN_ONLY === '1';
  const summaryLines = [
    '## Migration conflict check',
    '',
    `Result: ${errors.length > 0 && !warnOnly ? 'FAILED' : 'PASSED'}`,
    '',
    `- base ref: ${baseRef}`,
    `- head ref: ${headRef}`,
    `- merge-base: ${mergeBase}`,
    `- PR added migrations: ${prAddedMigrationPaths.length}`,
    `- base added migrations since merge-base: ${baseAddedMigrationPaths.length}`,
    `- base history migrations scanned: ${baseHistoryMigrationPaths.length}`,
    `- modified existing migrations in PR: ${modifiedExistingInPr.length}`,
    `- blocking conflicts: ${blockingConflicts.length}`,
    `- allowed conflicts: ${allowedConflicts.length}`,
  ];

  if (modifiedExistingInPr.length > 0) {
    summaryLines.push('', '### Modified existing migration files');
    for (const change of modifiedExistingInPr) {
      summaryLines.push(formatChangedMigrationLine(change));
    }
  }

  if (blockingConflicts.length > 0) {
    summaryLines.push('', '### Blocking conflicts');
    for (const conflict of blockingConflicts) {
      summaryLines.push(formatConflictSummaryLine(conflict));
    }
  }

  if (allowedConflicts.length > 0) {
    summaryLines.push('', '### Allowed conflicts');
    for (const conflict of allowedConflicts) {
      summaryLines.push(formatConflictSummaryLine(conflict));
    }
  }

  if (warnOnly && errors.length > 0) {
    summaryLines.push('', 'Mode: WARN_ONLY (MIGRATION_CONFLICT_WARN_ONLY=1).');
  }

  appendStepSummary(summaryLines);

  if (errors.length > 0) {
    console.error('ERROR: Migration conflict check failed.');
    console.error(errors.join('\n'));

    if (warnOnly) {
      console.warn('WARN: MIGRATION_CONFLICT_WARN_ONLY=1 so exiting with code 0.');
      process.exit(0);
    }

    process.exit(1);
  }

  console.log(
    `OK: Migration conflict check passed. PR additions: ${prAddedMigrationPaths.length}, base additions since merge-base: ${baseAddedMigrationPaths.length}, base history scanned: ${baseHistoryMigrationPaths.length}.`,
  );
}

main();
