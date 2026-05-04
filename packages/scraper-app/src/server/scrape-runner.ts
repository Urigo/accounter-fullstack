import { randomUUID } from 'node:crypto';
import type { RunRecord as SerializedRunRecord, SourceRunRecord } from '../shared/types.js';
import type { ServerMessage } from '../shared/ws-protocol.js';
import type { ScraperUploadResult } from './gql/index.js';

export const ERR_RUN_IN_PROGRESS = 'Run already in progress';

/**
 * Thrown by buildTask when a source is blocked (unknown accounts).
 * Signals runTask to skip task-done and task-error — task-blocked was already emitted.
 */
export class BlockedError extends Error {
  readonly blockedAccounts: string[];
  constructor(blockedAccounts: string[]) {
    super('blocked');
    this.name = 'BlockedError';
    this.blockedAccounts = blockedAccounts;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScrapeTask = {
  sourceId: string;
  nickname: string;
  type: string;
  run: () => Promise<ScraperUploadResult>;
};

export type { SourceRunRecord };
export type RunRecord = Omit<SerializedRunRecord, 'startedAt' | 'completedAt'> & {
  startedAt: Date;
  completedAt: Date;
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

    type TaskOutcome = {
      task: ScrapeTask;
      result: ScraperUploadResult;
      status: 'done' | 'error' | 'blocked';
      error?: string;
      blockedAccounts?: string[];
    };

    const runTask = async (task: ScrapeTask): Promise<TaskOutcome> => {
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
        return { task, result, status: 'done' };
      } catch (e) {
        // task-blocked was already emitted by buildTask — skip task-done and task-error
        if (e instanceof BlockedError) {
          return {
            task,
            result: {
              inserted: 0,
              skipped: 0,
              insertedIds: [],
              insertedTransactions: [],
              changedTransactions: [],
            },
            status: 'blocked',
            blockedAccounts: e.blockedAccounts,
          };
        }
        errorCount++;
        const message = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        emit({ type: 'task-error', sourceId: task.sourceId, message, ...(stack && { stack }) });
        return {
          task,
          result: {
            inserted: 0,
            skipped: 0,
            insertedIds: [],
            insertedTransactions: [],
            changedTransactions: [],
          },
          status: 'error',
          error: message,
        };
      }
    };

    let outcomes: TaskOutcome[];
    if (concurrent) {
      outcomes = await Promise.all(tasks.map(runTask));
    } else {
      outcomes = [];
      for (const task of tasks) {
        outcomes.push(await runTask(task));
      }
    }

    const totalInserted = outcomes.reduce((sum, o) => sum + o.result.inserted, 0);
    const totalSkipped = outcomes.reduce((sum, o) => sum + o.result.skipped, 0);
    const sources: SourceRunRecord[] = outcomes.map(o => ({
      sourceId: o.task.sourceId,
      nickname: o.task.nickname,
      sourceType: o.task.type,
      status: o.status,
      inserted: o.result.inserted,
      skipped: o.result.skipped,
      ...(o.error != null && { error: o.error }),
      ...(o.blockedAccounts != null && { blockedAccounts: o.blockedAccounts }),
    }));

    emit({ type: 'run-complete', totalInserted, totalSkipped, errors: errorCount });

    return {
      id,
      startedAt,
      completedAt: new Date(),
      totalInserted,
      totalSkipped,
      errorCount,
      sources,
    };
  } finally {
    _running = false;
  }
}
