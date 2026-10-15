import { readFile, writeFile } from 'node:fs/promises';
import type { RunRecord } from '../shared/types.js';

const MAX_RECORDS = 100;

// Per-file write queue: each appendRun chains onto the previous write for the
// same path, so concurrent calls never interleave their read-modify-write cycle.
const writeQueues = new Map<string, Promise<void>>();

function enqueue(filePath: string, work: () => Promise<void>): Promise<void> {
  const prev = writeQueues.get(filePath) ?? Promise.resolve();
  const next = prev.then(work, work); // run even if the previous write failed
  writeQueues.set(filePath, next);
  void next.finally(() => {
    if (writeQueues.get(filePath) === next) writeQueues.delete(filePath);
  });
  return next;
}

/** Unique by run id, oldest first, capped at MAX_RECORDS. */
function mergeRuns(...lists: RunRecord[][]): RunRecord[] {
  const byId = new Map<string, RunRecord>();
  for (const list of lists) for (const r of list) byId.set(r.id, r);
  return [...byId.values()]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(-MAX_RECORDS);
}

async function readFileRuns(filePath: string): Promise<RunRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
  } catch {
    return []; // file missing or unparseable — start fresh
  }
}

async function doAppend(newRecords: RunRecord[], filePath: string): Promise<void> {
  const records = mergeRuns(await readFileRuns(filePath), newRecords);
  await writeFile(filePath, JSON.stringify(records, null, 2), 'utf8');
}

// Runs from this server session, newest last. Always kept; the file is opt-in.
let sessionRuns: RunRecord[] = [];

export function recordSessionRun(record: RunRecord): void {
  sessionRuns = [...sessionRuns, record].slice(-MAX_RECORDS);
}

export function readSessionHistory(): RunRecord[] {
  return [...sessionRuns].reverse();
}

export function clearSessionHistory(): void {
  sessionRuns = [];
}

export function appendRun(record: RunRecord, filePath: string): Promise<void> {
  return enqueue(filePath, () => doAppend([record], filePath));
}

/** Writes this session's runs to the file — used when the user turns persistence on. */
export function persistSessionHistory(filePath: string): Promise<void> {
  return enqueue(filePath, () => doAppend(sessionRuns, filePath));
}

export async function readHistory(filePath: string): Promise<RunRecord[]> {
  return mergeRuns(await readFileRuns(filePath)).reverse();
}

/**
 * The file's runs plus this session's, newest first. Session runs are included so a run whose
 * append failed, or one from before persistence was turned on, still shows.
 */
export async function readPersistedHistory(filePath: string): Promise<RunRecord[]> {
  return mergeRuns(await readFileRuns(filePath), sessionRuns).reverse();
}

export async function clearHistory(filePath: string): Promise<void> {
  await writeFile(filePath, '[]', 'utf8');
}
