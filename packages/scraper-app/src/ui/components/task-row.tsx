import { useState, type ReactElement } from 'react';
import type { TaskState } from '../lib/ws.js';

type Props = {
  sourceId: string;
  nickname: string;
  state: TaskState;
  onNavigateAccounts?: () => void;
};

const BADGE_STYLES: Record<string, { background: string; color: string }> = {
  pending: { background: '#e5e7eb', color: '#374151' },
  running: { background: '#dbeafe', color: '#1d4ed8' },
  done: { background: '#dcfce7', color: '#15803d' },
  error: { background: '#fee2e2', color: '#b91c1c' },
  blocked: { background: '#fef9c3', color: '#854d0e' },
  'otp-required': { background: '#ede9fe', color: '#6d28d9' },
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  running: 'Running…',
  done: 'Done',
  error: 'Error',
  blocked: 'Blocked',
  'otp-required': 'OTP Required',
};

export function TaskRow({
  sourceId: _sourceId,
  nickname,
  state,
  onNavigateAccounts,
}: Props): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const badgeStyle = BADGE_STYLES[state.status] ?? BADGE_STYLES['pending']!;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 12px',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            ...badgeStyle,
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '0.8em',
            fontWeight: 600,
            minWidth: 80,
            textAlign: 'center',
          }}
        >
          {state.status === 'running' ? '⟳ ' : ''}
          {STATUS_LABELS[state.status] ?? state.status}
        </span>
        <span style={{ fontWeight: 500 }}>{nickname}</span>

        {state.status === 'done' && (
          <span style={{ marginLeft: 'auto', fontSize: '0.9em', color: '#555' }}>
            ↑ {state.inserted ?? 0} new / {state.skipped ?? 0} skipped
          </span>
        )}

        {state.status === 'error' && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#b91c1c',
              fontSize: '0.85em',
            }}
          >
            {expanded ? '▲ Hide' : '▼ Details'}
          </button>
        )}
      </div>

      {state.status === 'error' && expanded && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 4,
            padding: 10,
            fontSize: '0.85em',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{state.error}</div>
          {state.stack && (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#7f1d1d' }}>{state.stack}</pre>
          )}
        </div>
      )}

      {state.status === 'blocked' && (
        <div style={{ fontSize: '0.85em', color: '#713f12', paddingLeft: 4 }}>
          <div>Unknown accounts: {(state.blockedAccounts ?? []).join(', ')}</div>
          {onNavigateAccounts ? (
            <button
              type="button"
              onClick={onNavigateAccounts}
              style={{
                marginTop: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#1d4ed8',
                padding: 0,
                textDecoration: 'underline',
                fontSize: '0.95em',
              }}
            >
              Go to Accounts tab
            </button>
          ) : (
            <span style={{ color: '#1d4ed8' }}>Go to Accounts tab</span>
          )}
        </div>
      )}
    </div>
  );
}
