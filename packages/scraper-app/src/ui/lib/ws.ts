import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, RunCompleteMessage } from '../../shared/ws-protocol.js';
import { ServerMessageSchema } from '../../shared/ws-protocol.js';

export type TaskStatus = 'pending' | 'running' | 'done' | 'error' | 'blocked' | 'otp-required';

export type InsertedTransactionSummary = {
  id: string;
  date?: string | null | undefined;
  description?: string | null | undefined;
  amount?: string | null | undefined;
  account?: string | null | undefined;
};

export type ChangedTransaction = {
  id: string;
  changedFields: {
    field: string;
    oldValue?: string | null | undefined;
    newValue?: string | null | undefined;
  }[];
};

export type MonthStepPhase = 'fetching' | 'fetched' | 'error' | 'uploading' | 'uploaded';

export type MonthStep = {
  month: string;
  phase: MonthStepPhase;
  transactionCount?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
};

export type TxnTypeState = {
  phase: 'fetching' | 'uploading' | 'done';
  count?: number;
  inserted?: number;
  skipped?: number;
};

export type AccountStep = {
  accountId: string;
  vaultStatus?: 'accepted' | 'ignored' | 'blocked' | 'unknown';
  ils?: TxnTypeState;
  foreign?: TxnTypeState;
  swift?: TxnTypeState;
};

export type TaskState = {
  status: TaskStatus;
  inserted?: number;
  skipped?: number;
  error?: string;
  stack?: string;
  blockedAccounts?: string[];
  otpSourceId?: string;
  insertedTransactions?: InsertedTransactionSummary[];
  changedTransactions?: ChangedTransaction[];
  steps?: MonthStep[] | AccountStep[];
};

export type RunStatus = 'idle' | 'running' | 'complete';

export type UseRunSocketResult = {
  send: (msg: ClientMessage) => void;
  taskStates: Map<string, TaskState>;
  runStatus: RunStatus;
  summary: RunCompleteMessage | null;
};

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

function findOrCreateMonthStep(steps: MonthStep[], month: string): [MonthStep[], MonthStep] {
  const existing = steps.find(s => s.month === month);
  if (existing) return [steps, existing];
  const newStep: MonthStep = { month, phase: 'fetching' };
  return [[...steps, newStep], newStep];
}

function updateMonthStep(
  steps: MonthStep[],
  month: string,
  patch: Partial<MonthStep>,
): MonthStep[] {
  return steps.map(s => (s.month === month ? { ...s, ...patch } : s));
}

function findOrCreateAccountStep(
  steps: AccountStep[],
  accountId: string,
): [AccountStep[], AccountStep] {
  const existing = steps.find(s => s.accountId === accountId);
  if (existing) return [steps, existing];
  const newStep: AccountStep = { accountId };
  return [[...steps, newStep], newStep];
}

function updateAccountStep(
  steps: AccountStep[],
  accountId: string,
  patch: Partial<AccountStep>,
): AccountStep[] {
  return steps.map(s => (s.accountId === accountId ? { ...s, ...patch } : s));
}

function asMonthSteps(steps: MonthStep[] | AccountStep[] | undefined): MonthStep[] {
  if (!steps || (steps.length > 0 && 'accountId' in steps[0]!)) return [];
  return steps as MonthStep[];
}

function asAccountSteps(steps: MonthStep[] | AccountStep[] | undefined): AccountStep[] {
  if (!steps || (steps.length > 0 && 'month' in steps[0]!)) return [];
  return steps as AccountStep[];
}

export function useRunSocket(): UseRunSocketResult {
  const [taskStates, setTaskStates] = useState<Map<string, TaskState>>(new Map());
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [summary, setSummary] = useState<RunCompleteMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onmessage = event => {
      let raw: unknown;
      try {
        raw = JSON.parse(event.data as string);
      } catch {
        return;
      }

      const result = ServerMessageSchema.safeParse(raw);
      if (!result.success) return;
      const msg = result.data;

      setTaskStates(prev => {
        const next = new Map(prev);
        const get = (id: string): TaskState => next.get(id) ?? { status: 'pending' };

        switch (msg.type) {
          case 'task-pending':
            next.set(msg.sourceId, { status: 'pending' });
            break;
          case 'task-running':
            next.set(msg.sourceId, { ...get(msg.sourceId), status: 'running' });
            break;
          case 'task-done':
            next.set(msg.sourceId, {
              ...get(msg.sourceId),
              status: 'done',
              inserted: msg.inserted,
              skipped: msg.skipped,
              insertedTransactions: msg.insertedTransactions,
              changedTransactions: msg.changedTransactions,
            });
            break;
          case 'task-error':
            next.set(msg.sourceId, { status: 'error', error: msg.message, stack: msg.stack });
            break;
          case 'task-blocked':
            next.set(msg.sourceId, {
              status: 'blocked',
              blockedAccounts: msg.unknownAccounts,
            });
            break;
          case 'otp-required':
            next.set(msg.sourceId, {
              ...get(msg.sourceId),
              status: 'otp-required',
              otpSourceId: msg.sourceId,
            });
            break;

          // ── Per-month progress ─────────────────────────────────────────────
          case 'task-month-fetching': {
            const state = get(msg.sourceId);
            const monthSteps = asMonthSteps(state.steps);
            const [updated] = findOrCreateMonthStep(monthSteps, msg.month);
            next.set(msg.sourceId, {
              ...state,
              steps: updateMonthStep(updated, msg.month, { phase: 'fetching' }),
            });
            break;
          }
          case 'task-month-fetched': {
            const state = get(msg.sourceId);
            const monthSteps = asMonthSteps(state.steps);
            const [updated] = findOrCreateMonthStep(monthSteps, msg.month);
            next.set(msg.sourceId, {
              ...state,
              steps: updateMonthStep(updated, msg.month, {
                phase: 'fetched',
                transactionCount: msg.transactionCount,
              }),
            });
            break;
          }
          case 'task-month-error': {
            const state = get(msg.sourceId);
            const monthSteps = asMonthSteps(state.steps);
            const [updated] = findOrCreateMonthStep(monthSteps, msg.month);
            next.set(msg.sourceId, {
              ...state,
              steps: updateMonthStep(updated, msg.month, { phase: 'error', error: msg.error }),
            });
            break;
          }
          case 'task-month-uploading': {
            const state = get(msg.sourceId);
            const monthSteps = asMonthSteps(state.steps);
            const [updated] = findOrCreateMonthStep(monthSteps, msg.month);
            next.set(msg.sourceId, {
              ...state,
              steps: updateMonthStep(updated, msg.month, {
                phase: 'uploading',
                transactionCount: msg.transactionCount,
              }),
            });
            break;
          }
          case 'task-month-uploaded': {
            const state = get(msg.sourceId);
            const monthSteps = asMonthSteps(state.steps);
            const [updated] = findOrCreateMonthStep(monthSteps, msg.month);
            next.set(msg.sourceId, {
              ...state,
              steps: updateMonthStep(updated, msg.month, {
                phase: 'uploaded',
                inserted: msg.inserted,
                skipped: msg.skipped,
              }),
            });
            break;
          }

          // ── Per-account progress (Poalim) ──────────────────────────────────
          case 'task-accounts-found': {
            const state = get(msg.sourceId);
            const steps: AccountStep[] = msg.accounts.map(a => ({ accountId: a.accountNumber }));
            next.set(msg.sourceId, { ...state, steps });
            break;
          }
          case 'task-account-vault-checked': {
            const state = get(msg.sourceId);
            const accountSteps = asAccountSteps(state.steps);
            const [updated] = findOrCreateAccountStep(accountSteps, msg.accountId);
            next.set(msg.sourceId, {
              ...state,
              steps: updateAccountStep(updated, msg.accountId, { vaultStatus: msg.status }),
            });
            break;
          }
          case 'task-account-txns-fetching': {
            const state = get(msg.sourceId);
            const accountSteps = asAccountSteps(state.steps);
            const [updated, step] = findOrCreateAccountStep(accountSteps, msg.accountId);
            const txnPatch: Partial<AccountStep> = {
              [msg.txnType]: { phase: 'fetching' as const },
            };
            next.set(msg.sourceId, {
              ...state,
              steps: updateAccountStep(updated, msg.accountId, { ...step, ...txnPatch }),
            });
            break;
          }
          case 'task-account-txns-uploading': {
            const state = get(msg.sourceId);
            const accountSteps = asAccountSteps(state.steps);
            const [updated, step] = findOrCreateAccountStep(accountSteps, msg.accountId);
            const txnPatch: Partial<AccountStep> = {
              [msg.txnType]: { phase: 'uploading' as const, count: msg.count },
            };
            next.set(msg.sourceId, {
              ...state,
              steps: updateAccountStep(updated, msg.accountId, { ...step, ...txnPatch }),
            });
            break;
          }
          case 'task-account-txns-done': {
            const state = get(msg.sourceId);
            const accountSteps = asAccountSteps(state.steps);
            const [updated, step] = findOrCreateAccountStep(accountSteps, msg.accountId);
            const txnPatch: Partial<AccountStep> = {
              [msg.txnType]: {
                phase: 'done' as const,
                inserted: msg.inserted,
                skipped: msg.skipped,
              },
            };
            next.set(msg.sourceId, {
              ...state,
              steps: updateAccountStep(updated, msg.accountId, { ...step, ...txnPatch }),
            });
            break;
          }

          default:
            break;
        }
        return next;
      });

      if (msg.type === 'run-complete') {
        setRunStatus('complete');
        setSummary(msg);
      } else if (msg.type === 'task-running') {
        setRunStatus('running');
      }
    };

    return () => {
      wsRef.current = null;
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else {
        ws.close();
      }
    };
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, taskStates, runStatus, summary };
}
