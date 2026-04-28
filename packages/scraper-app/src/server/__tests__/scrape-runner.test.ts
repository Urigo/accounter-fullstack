import { afterEach, describe, expect, it } from 'vitest';
import { _resetRunState, startRun, type ScrapeTask } from '../scrape-runner.js';
import type { ServerMessage } from '../../shared/ws-protocol.js';

type TaskResult = { inserted: number; skipped: number; insertedIds: string[] };

function makeTask(
  sourceId: string,
  run: () => Promise<TaskResult> = async () => ({
    inserted: 2,
    skipped: 1,
    insertedIds: ['id-1', 'id-2'],
  }),
): ScrapeTask {
  return { sourceId, nickname: sourceId, type: 'poalim', run };
}

afterEach(() => {
  _resetRunState();
});

// ── Sequential ────────────────────────────────────────────────────────────────

describe('sequential mode', () => {
  it('emits pending×2 → running→done task1 → running→done task2 → run-complete', async () => {
    const events: ServerMessage[] = [];
    const emit = (msg: ServerMessage) => events.push(msg);

    await startRun([makeTask('src-1'), makeTask('src-2')], false, emit);

    expect(events[0]).toEqual({ type: 'task-pending', sourceId: 'src-1' });
    expect(events[1]).toEqual({ type: 'task-pending', sourceId: 'src-2' });
    expect(events[2]).toMatchObject({ type: 'task-running', sourceId: 'src-1' });
    expect(events[3]).toMatchObject({ type: 'task-done', sourceId: 'src-1', inserted: 2, skipped: 1 });
    expect(events[4]).toMatchObject({ type: 'task-running', sourceId: 'src-2' });
    expect(events[5]).toMatchObject({ type: 'task-done', sourceId: 'src-2', inserted: 2, skipped: 1 });
    expect(events[6]).toEqual({ type: 'run-complete', totalInserted: 4, totalSkipped: 2 });
    expect(events).toHaveLength(7);
  });

  it('returns a RunRecord with correct totals and timestamps', async () => {
    const before = new Date();
    const record = await startRun([makeTask('src-1')], false, () => {});
    const after = new Date();

    expect(record.id).toMatch(/^[\da-f-]{36}$/);
    expect(record.totalInserted).toBe(2);
    expect(record.totalSkipped).toBe(1);
    expect(record.startedAt >= before).toBe(true);
    expect(record.finishedAt <= after).toBe(true);
  });
});

// ── Concurrent ────────────────────────────────────────────────────────────────

describe('concurrent mode', () => {
  it('both running events arrive before either done event', async () => {
    const events: ServerMessage[] = [];
    const emit = (msg: ServerMessage) => events.push(msg);

    const delayed = (): Promise<TaskResult> =>
      new Promise(res => setTimeout(() => res({ inserted: 1, skipped: 0, insertedIds: ['x'] }), 20));

    await startRun([makeTask('src-1', delayed), makeTask('src-2', delayed)], true, emit);

    const runningIdxs = events.flatMap((e, i) => (e.type === 'task-running' ? [i] : []));
    const doneIdxs = events.flatMap((e, i) => (e.type === 'task-done' ? [i] : []));

    expect(runningIdxs).toHaveLength(2);
    expect(doneIdxs).toHaveLength(2);
    expect(Math.max(...runningIdxs)).toBeLessThan(Math.min(...doneIdxs));
  });

  it('totals reflect both tasks', async () => {
    const record = await startRun(
      [makeTask('src-1'), makeTask('src-2')],
      true,
      () => {},
    );
    expect(record.totalInserted).toBe(4);
    expect(record.totalSkipped).toBe(2);
  });
});

// ── Task error ────────────────────────────────────────────────────────────────

describe('task error handling', () => {
  it('emits task-error when run() throws, other task still completes', async () => {
    const events: ServerMessage[] = [];
    const emit = (msg: ServerMessage) => events.push(msg);

    const failing = makeTask('src-1', async () => {
      throw new Error('Scraper exploded');
    });

    await startRun([failing, makeTask('src-2')], false, emit);

    const taskError = events.find(
      e => e.type === 'task-error' && 'sourceId' in e && e.sourceId === 'src-1',
    );
    expect(taskError).toBeTruthy();
    expect((taskError as { message: string }).message).toContain('Scraper exploded');

    expect(events.some(e => e.type === 'task-done' && 'sourceId' in e && e.sourceId === 'src-2')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'run-complete' });
  });

  it('run-complete totals reflect only the successful task', async () => {
    const record = await startRun(
      [
        makeTask('src-1', async () => {
          throw new Error('fail');
        }),
        makeTask('src-2'),
      ],
      false,
      () => {},
    );
    expect(record.totalInserted).toBe(2); // only src-2
    expect(record.totalSkipped).toBe(1);
  });
});

// ── In-progress guard ─────────────────────────────────────────────────────────

describe('in-progress guard', () => {
  it('throws when called while a run is already in progress', async () => {
    const neverResolves = (): Promise<TaskResult> => new Promise(_r => {});

    // Start a run that never finishes (don't await it)
    const firstRun = startRun([makeTask('src-1', neverResolves)], false, () => {});

    // Second call should reject immediately because _running is already true
    await expect(startRun([makeTask('src-2')], false, () => {})).rejects.toThrow(
      'Run already in progress',
    );

    // Cleanup: _resetRunState is called in afterEach, firstRun hangs but that's OK
    void firstRun;
  });
});
