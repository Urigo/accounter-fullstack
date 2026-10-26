#!/usr/bin/env node
// Checks a GitHub pull-request review against the PR's diff before it is posted.
//
//   gh pr diff <pr> | node check-review.mjs --lines              # commentable RIGHT-side lines per file
//   gh pr diff <pr> | node check-review.mjs <review-payload.json> # validate the payload's comments[]
//
// GitHub only accepts an inline comment on a line that appears in a diff hunk on the side it names.
// For side RIGHT that is an added (`+`) or context (` `) line, numbered in the new file. Anything
// else makes the whole review POST fail with a 422, so check first and post once.
import { readFileSync } from 'node:fs';

function parseDiff(diff) {
  /** @type {Map<string, Set<number>>} */
  const files = new Map();
  let current = null;
  let newLine = 0;
  let inHunk = false;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      current = null;
      inHunk = false;
      continue;
    }
    if (!inHunk && raw.startsWith('+++ ')) {
      const path = raw.slice(4).trim();
      current = path === '/dev/null' ? null : path.replace(/^b\//, '');
      if (current && !files.has(current)) files.set(current, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      newLine = Number(hunk[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk || !current) continue;
    if (raw.startsWith('+') || raw.startsWith(' ')) {
      files.get(current).add(newLine);
      newLine += 1;
    } else if (raw.startsWith('\\')) {
      // "\ No newline at end of file"
    } else if (!raw.startsWith('-')) {
      inHunk = false; // blank separator or the next file's header
    }
  }
  return files;
}

function toRanges(lines) {
  const sorted = [...lines].sort((a, b) => a - b);
  const ranges = [];
  for (const n of sorted) {
    const last = ranges.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', ');
}

const files = parseDiff(readFileSync(0, 'utf8'));
const arg = process.argv[2];

if (!arg || arg === '--lines') {
  for (const [path, lines] of files)
    console.log(`${path}: ${lines.size ? toRanges(lines) : '(none)'}`);
  process.exit(0);
}

const payload = JSON.parse(readFileSync(arg, 'utf8'));
const problems = [];
if (payload.event !== 'COMMENT')
  problems.push(`event is ${JSON.stringify(payload.event)}, expected "COMMENT"`);
if (!payload.commit_id) problems.push('commit_id is missing (use the PR head SHA)');

for (const [i, c] of (payload.comments ?? []).entries()) {
  const where = `comments[${i}] ${c.path}:${c.start_line ? `${c.start_line}-` : ''}${c.line}`;
  const lines = files.get(c.path);
  if (!lines) {
    problems.push(`${where}: path is not in the diff`);
    continue;
  }
  if ((c.side ?? 'RIGHT') !== 'RIGHT') problems.push(`${where}: side must be RIGHT`);
  if (c.start_line != null && (c.start_side ?? 'RIGHT') !== 'RIGHT')
    problems.push(`${where}: start_side must be RIGHT`);
  if (c.start_line != null && c.start_line >= c.line)
    problems.push(`${where}: start_line must be < line`);
  const from = c.start_line ?? c.line;
  for (let n = from; n <= c.line; n++) {
    if (!lines.has(n)) {
      problems.push(
        `${where}: line ${n} is not on the RIGHT side of a hunk (valid: ${toRanges(lines)})`,
      );
      break;
    }
  }
  if (!c.body?.trim()) problems.push(`${where}: empty body`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `OK: ${payload.comments?.length ?? 0} inline comment(s) all land on RIGHT-side diff lines.`,
);
