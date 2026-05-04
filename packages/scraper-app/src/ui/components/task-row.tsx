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
          <>
            <span style={{ marginLeft: 'auto', fontSize: '0.9em', color: '#555' }}>
              ↑ {state.inserted ?? 0} new / {state.skipped ?? 0} skipped
              {(state.changedTransactions?.length ?? 0) > 0 && (
                <> / {state.changedTransactions!.length} changed</>
              )}
            </span>
            {((state.insertedTransactions?.length ?? 0) > 0 ||
              (state.changedTransactions?.length ?? 0) > 0) && (
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#374151',
                  fontSize: '0.85em',
                }}
              >
                {expanded ? '▲ Hide' : '▼ Details'}
              </button>
            )}
          </>
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

      {state.status === 'done' && expanded && (
        <div style={{ fontSize: '0.85em', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(state.insertedTransactions?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                New transactions ({state.insertedTransactions!.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                    <th style={{ padding: '2px 8px 2px 0' }}>Date</th>
                    <th style={{ padding: '2px 8px 2px 0' }}>Description</th>
                    <th style={{ padding: '2px 8px 2px 0' }}>Amount</th>
                    <th style={{ padding: '2px 0' }}>Account</th>
                  </tr>
                </thead>
                <tbody>
                  {state.insertedTransactions!.map(t => (
                    <tr key={t.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '2px 8px 2px 0', color: '#6b7280' }}>
                        {t.date ?? '—'}
                      </td>
                      <td style={{ padding: '2px 8px 2px 0' }}>{t.description ?? '—'}</td>
                      <td style={{ padding: '2px 8px 2px 0', fontVariantNumeric: 'tabular-nums' }}>
                        {t.amount ?? '—'}
                      </td>
                      <td style={{ padding: '2px 0', color: '#6b7280' }}>{t.account ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(state.changedTransactions?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#b45309' }}>
                Changed transactions ({state.changedTransactions!.length})
              </div>
              {state.changedTransactions!.map(ct => (
                <div
                  key={ct.id}
                  style={{
                    marginBottom: 6,
                    padding: '6px 8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ color: '#6b7280', marginBottom: 4, fontFamily: 'monospace' }}>
                    {ct.id}
                  </div>
                  <table style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                        <th style={{ padding: '1px 12px 1px 0' }}>Field</th>
                        <th style={{ padding: '1px 12px 1px 0' }}>Old</th>
                        <th style={{ padding: '1px 0' }}>New</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ct.changedFields.map(f => (
                        <tr key={f.field} style={{ borderTop: '1px solid #fde68a' }}>
                          <td style={{ padding: '1px 12px 1px 0', fontFamily: 'monospace' }}>
                            {f.field}
                          </td>
                          <td style={{ padding: '1px 12px 1px 0', color: '#b91c1c' }}>
                            {f.oldValue ?? '—'}
                          </td>
                          <td style={{ padding: '1px 0', color: '#15803d' }}>
                            {f.newValue ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
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
