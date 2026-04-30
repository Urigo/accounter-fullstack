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

async function doAppend(record: RunRecord, filePath: string): Promise<void> {
  let records: RunRecord[] = [];
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    records = Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
  } catch {
    // file missing or unparseable — start fresh
  }
  records.push(record);
  if (records.length > MAX_RECORDS) {
    records = records.slice(-MAX_RECORDS);
  }
  await writeFile(filePath, JSON.stringify(records, null, 2), 'utf8');
}

export function appendRun(record: RunRecord, filePath: string): Promise<void> {
  return enqueue(filePath, () => doAppend(record, filePath));
}

export async function readHistory(filePath: string): Promise<RunRecord[]> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
    return records.slice(-MAX_RECORDS).reverse();
  } catch {
    return [];
  }
}

export async function clearHistory(filePath: string): Promise<void> {
  await writeFile(filePath, '[]', 'utf8');
}
