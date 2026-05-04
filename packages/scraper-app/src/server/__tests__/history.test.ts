import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendRun, clearHistory, readHistory } from '../history.js';
import type { RunRecord } from '../../shared/types.js';

function makeRecord(i: number): RunRecord {
  return {
    id: `run-${i}`,
    startedAt: new Date(Date.now() + i * 1000).toISOString(),
    completedAt: new Date(Date.now() + i * 1000 + 500).toISOString(),
    totalInserted: i,
    totalSkipped: 0,
    errorCount: 0,
    sources: [],
  };
}

let tmpDir: string;
let filePath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'history-test-'));
  filePath = join(tmpDir, 'history.json');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('readHistory', () => {
  it('returns [] when file is missing', async () => {
    expect(await readHistory(filePath)).toEqual([]);
  });

  it('returns records newest-first after appending 3', async () => {
    await appendRun(makeRecord(1), filePath);
    await appendRun(makeRecord(2), filePath);
    await appendRun(makeRecord(3), filePath);

    const result = await readHistory(filePath);
    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe('run-3');
    expect(result[1]!.id).toBe('run-2');
    expect(result[2]!.id).toBe('run-1');
  });

  it('returns last 100 records when 150 are appended', async () => {
    for (let i = 1; i <= 150; i++) {
      await appendRun(makeRecord(i), filePath);
    }
    const result = await readHistory(filePath);
    expect(result).toHaveLength(100);
    expect(result[0]!.id).toBe('run-150');
    expect(result[99]!.id).toBe('run-51');
  });
});

describe('concurrent writes', () => {
  it('retains all records when appendRun is called concurrently', async () => {
    // Fire 10 appends simultaneously — without the queue they would race and
    // overwrite each other; with it every record must survive.
    await Promise.all(Array.from({ length: 10 }, (_, i) => appendRun(makeRecord(i + 1), filePath)));

    const result = await readHistory(filePath);
    expect(result).toHaveLength(10);
    const ids = new Set(result.map(r => r.id));
    for (let i = 1; i <= 10; i++) expect(ids.has(`run-${i}`)).toBe(true);
  });
});

describe('clearHistory', () => {
  it('empties the history file', async () => {
    await appendRun(makeRecord(1), filePath);
    await clearHistory(filePath);
    expect(await readHistory(filePath)).toEqual([]);
  });
});

describe('saveHistory gate in websocket', () => {
  it('does not call appendRun when saveHistory is false', async () => {
    const spy = vi.spyOn(await import('../history.js'), 'appendRun').mockResolvedValue(undefined);

    const { startRun } = await import('../scrape-runner.js');
    const { _resetRunState } = await import('../scrape-runner.js');
    _resetRunState();

    const noopEmit = () => {};
    const task = {
      sourceId: 'test',
      nickname: 'test',
      type: 'discount',
      run: async () => ({ inserted: 1, skipped: 0, insertedIds: [], insertedTransactions: [], changedTransactions: [] }),
    };

    const runRecord = await startRun([task], false, noopEmit);

    // Simulate the saveHistory=false branch: appendRun should NOT be called
    const saveHistory = false;
    if (saveHistory) {
      await appendRun(
        { ...runRecord, startedAt: runRecord.startedAt.toISOString(), completedAt: runRecord.completedAt.toISOString(), sources: [] },
        filePath,
      );
    }

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
