import { randomUUID } from 'node:crypto';
import type { SourceType } from '../shared/source-types.js';
import type { ServerMessage } from '../shared/ws-protocol.js';

export const ERR_RUN_IN_PROGRESS = 'Run already in progress';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScrapeTask = {
  sourceId: string;
  nickname: string;
  type: SourceType;
  run: () => Promise<{ inserted: number; skipped: number; insertedIds: string[] }>;
};

export type RunRecord = {
  id: string;
  startedAt: Date;
  finishedAt: Date;
  totalInserted: number;
  totalSkipped: number;
};

// ── State ─────────────────────────────────────────────────────────────────────

let _running = false;

export function isRunning(): boolean {
  return _running;
}

export function _resetRunState(): void {
  _running = false;
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function startRun(
  tasks: ScrapeTask[],
  concurrent: boolean,
  emit: (msg: ServerMessage) => void,
): Promise<RunRecord> {
  if (_running) throw new Error(ERR_RUN_IN_PROGRESS);
  _running = true;

  const id = randomUUID();
  const startedAt = new Date();

  try {
    for (const task of tasks) {
      emit({ type: 'task-pending', sourceId: task.sourceId });
    }

    type TaskResult = { inserted: number; skipped: number; insertedIds: string[] };

    const runTask = async (task: ScrapeTask): Promise<TaskResult> => {
      emit({ type: 'task-running', sourceId: task.sourceId });
      try {
        const result = await task.run();
        emit({ type: 'task-done', sourceId: task.sourceId, ...result });
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        emit({ type: 'task-error', sourceId: task.sourceId, message });
        return { inserted: 0, skipped: 0, insertedIds: [] };
      }
    };

    let results: TaskResult[];
    if (concurrent) {
      results = await Promise.all(tasks.map(runTask));
    } else {
      results = [];
      for (const task of tasks) {
        results.push(await runTask(task));
      }
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

    emit({ type: 'run-complete', totalInserted, totalSkipped });

    return { id, startedAt, finishedAt: new Date(), totalInserted, totalSkipped };
  } finally {
    _running = false;
  }
}
