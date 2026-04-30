import { randomUUID } from 'node:crypto';
import type { ServerMessage } from '../shared/ws-protocol.js';

export const ERR_RUN_IN_PROGRESS = 'Run already in progress';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InsertedTransactionSummary = {
  id: string;
  date?: string | null;
  description?: string | null;
  amount?: string | null;
  account?: string | null;
};

export type ChangedTransactionField = {
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export type ChangedTransaction = {
  id: string;
  changedFields: ChangedTransactionField[];
};

export type TaskResult = {
  inserted: number;
  skipped: number;
  insertedIds: string[];
  insertedTransactions?: InsertedTransactionSummary[];
  changedTransactions?: ChangedTransaction[];
};

export type ScrapeTask = {
  sourceId: string;
  nickname: string;
  type: string;
  run: () => Promise<TaskResult>;
};

export type RunRecord = {
  id: string;
  startedAt: Date;
  finishedAt: Date;
  totalInserted: number;
  totalSkipped: number;
  errorCount: number;
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
  let errorCount = 0;

  try {
    for (const task of tasks) {
      emit({ type: 'task-pending', sourceId: task.sourceId });
    }

    const runTask = async (task: ScrapeTask): Promise<TaskResult> => {
      emit({ type: 'task-running', sourceId: task.sourceId });
      try {
        const result = await task.run();
        emit({
          type: 'task-done',
          sourceId: task.sourceId,
          inserted: result.inserted,
          skipped: result.skipped,
          insertedIds: result.insertedIds,
          ...(result.insertedTransactions != null && {
            insertedTransactions: result.insertedTransactions,
          }),
          ...(result.changedTransactions != null && {
            changedTransactions: result.changedTransactions,
          }),
        });
        return result;
      } catch (e) {
        errorCount++;
        const message = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        emit({ type: 'task-error', sourceId: task.sourceId, message, ...(stack && { stack }) });
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

    emit({ type: 'run-complete', totalInserted, totalSkipped, errors: errorCount });

    return { id, startedAt, finishedAt: new Date(), totalInserted, totalSkipped, errorCount };
  } finally {
    _running = false;
  }
}
