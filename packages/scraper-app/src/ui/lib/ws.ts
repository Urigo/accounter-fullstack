import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, RunCompleteMessage } from '../../shared/ws-protocol.js';
import { ServerMessageSchema } from '../../shared/ws-protocol.js';

export type TaskStatus = 'pending' | 'running' | 'done' | 'error' | 'blocked' | 'otp-required';

export type TaskState = {
  status: TaskStatus;
  inserted?: number;
  skipped?: number;
  error?: string;
  stack?: string;
  blockedAccounts?: string[];
  otpSourceId?: string;
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
        switch (msg.type) {
          case 'task-pending':
            next.set(msg.sourceId, { status: 'pending' });
            break;
          case 'task-running':
            next.set(msg.sourceId, { ...next.get(msg.sourceId), status: 'running' });
            break;
          case 'task-done':
            next.set(msg.sourceId, {
              status: 'done',
              inserted: msg.inserted,
              skipped: msg.skipped,
            });
            break;
          case 'task-error':
            next.set(msg.sourceId, { status: 'error', error: msg.message });
            break;
          case 'task-blocked':
            next.set(msg.sourceId, {
              status: 'blocked',
              blockedAccounts: msg.unknownAccounts,
            });
            break;
          case 'otp-required':
            next.set(msg.sourceId, {
              ...next.get(msg.sourceId),
              status: 'otp-required',
              otpSourceId: msg.sourceId,
            });
            break;
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
