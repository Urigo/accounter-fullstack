import { useEffect, useState, type ReactElement } from 'react';
import type { AccountStep, MonthStep, TaskState } from '../lib/ws.js';

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

const MONTH_PHASE_BADGE: Record<string, { background: string; color: string; label: string }> = {
  fetching: { background: '#dbeafe', color: '#1d4ed8', label: '⟳ Fetching' },
  fetched: { background: '#e5e7eb', color: '#374151', label: 'Fetched' },
  error: { background: '#fee2e2', color: '#b91c1c', label: 'Error' },
  uploading: { background: '#fef9c3', color: '#854d0e', label: '⟳ Uploading' },
  uploaded: { background: '#dcfce7', color: '#15803d', label: 'Uploaded' },
};

const TXN_PHASE_BADGE: Record<string, { background: string; color: string; label: string }> = {
  fetching: { background: '#dbeafe', color: '#1d4ed8', label: '⟳' },
  uploading: { background: '#fef9c3', color: '#854d0e', label: '⟳' },
  done: { background: '#dcfce7', color: '#15803d', label: '✓' },
};

const VAULT_STATUS_BADGE: Record<string, { background: string; color: string }> = {
  accepted: { background: '#dcfce7', color: '#15803d' },
  ignored: { background: '#e5e7eb', color: '#6b7280' },
  blocked: { background: '#fee2e2', color: '#b91c1c' },
  unknown: { background: '#fef9c3', color: '#854d0e' },
};

function Badge({
  style,
  children,
}: {
  style: { background: string; color: string };
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        ...style,
        padding: '1px 6px',
        borderRadius: 10,
        fontSize: '0.75em',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function MonthStepsTable({ steps }: { steps: MonthStep[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82em' }}>
      <thead>
        <tr style={{ color: '#6b7280', textAlign: 'left' }}>
          <th style={{ padding: '2px 8px 2px 0' }}>Month</th>
          <th style={{ padding: '2px 8px 2px 0' }}>Status</th>
          <th style={{ padding: '2px 8px 2px 0' }}>Transactions</th>
          <th style={{ padding: '2px 8px 2px 0' }}>Inserted</th>
          <th style={{ padding: '2px 8px 2px 0' }}>Skipped</th>
          <th style={{ padding: '2px 0' }}>Error</th>
        </tr>
      </thead>
      <tbody>
        {steps.map(step => {
          const badge = MONTH_PHASE_BADGE[step.phase] ?? MONTH_PHASE_BADGE['fetching']!;
          return (
            <tr key={step.month} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={{ padding: '2px 8px 2px 0', fontVariantNumeric: 'tabular-nums' }}>
                {step.month}
              </td>
              <td style={{ padding: '2px 8px 2px 0' }}>
                <Badge style={badge}>{badge.label}</Badge>
              </td>
              <td style={{ padding: '2px 8px 2px 0', color: '#6b7280' }}>
                {step.transactionCount ?? '—'}
              </td>
              <td style={{ padding: '2px 8px 2px 0', color: '#15803d' }}>{step.inserted ?? '—'}</td>
              <td style={{ padding: '2px 8px 2px 0', color: '#6b7280' }}>{step.skipped ?? '—'}</td>
              <td
                style={{
                  padding: '2px 0',
                  color: '#b91c1c',
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.error ?? ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TxnTypeCell({
  state,
}: {
  state: { phase: string; count?: number; inserted?: number; skipped?: number } | undefined;
}) {
  if (!state) return <td style={{ padding: '2px 8px 2px 0', color: '#d1d5db' }}>—</td>;
  const badge = TXN_PHASE_BADGE[state.phase] ?? TXN_PHASE_BADGE['fetching']!;
  return (
    <td style={{ padding: '2px 8px 2px 0' }}>
      <Badge style={badge}>{badge.label}</Badge>
      {state.phase === 'done' && (
        <span style={{ marginLeft: 4, color: '#6b7280', fontSize: '0.9em' }}>
          {state.inserted ?? 0}↑ {state.skipped ?? 0}–
        </span>
      )}
      {state.phase === 'uploading' && state.count != null && (
        <span style={{ marginLeft: 4, color: '#6b7280', fontSize: '0.9em' }}>{state.count}</span>
      )}
    </td>
  );
}

function AccountStepsTable({ steps }: { steps: AccountStep[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82em' }}>
      <thead>
        <tr style={{ color: '#6b7280', textAlign: 'left' }}>
          <th style={{ padding: '2px 8px 2px 0' }}>Account</th>
          <th style={{ padding: '2px 8px 2px 0' }}>Vault</th>
          <th style={{ padding: '2px 8px 2px 0' }}>ILS</th>
          <th style={{ padding: '2px 8px 2px 0' }}>Foreign</th>
          <th style={{ padding: '2px 0' }}>Swift</th>
        </tr>
      </thead>
      <tbody>
        {steps.map(step => {
          const vaultBadge = step.vaultStatus ? VAULT_STATUS_BADGE[step.vaultStatus] : undefined;
          return (
            <tr key={step.accountId} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={{ padding: '2px 8px 2px 0', fontFamily: 'monospace' }}>
                {step.accountId}
              </td>
              <td style={{ padding: '2px 8px 2px 0' }}>
                {vaultBadge ? <Badge style={vaultBadge}>{step.vaultStatus}</Badge> : '—'}
              </td>
              <TxnTypeCell state={step.ils} />
              <TxnTypeCell state={step.foreign} />
              <TxnTypeCell state={step.swift} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TaskSteps({ steps, status }: { steps: MonthStep[] | AccountStep[]; status: string }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (status === 'done' || status === 'error' || status === 'blocked') {
      setCollapsed(true);
    }
  }, [status]);

  if (steps.length === 0) return null;

  const isAccountSteps = 'accountId' in steps[0]!;

  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#6b7280',
          fontSize: '0.8em',
          padding: '0 0 4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {collapsed ? '▸' : '▾'} {isAccountSteps ? 'Accounts' : 'Months'} ({steps.length})
      </button>
      {!collapsed && (
        <div style={{ paddingLeft: 4 }}>
          {isAccountSteps ? (
            <AccountStepsTable steps={steps as AccountStep[]} />
          ) : (
            <MonthStepsTable steps={steps as MonthStep[]} />
          )}
        </div>
      )}
    </div>
  );
}

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

      {state.steps && state.steps.length > 0 && (
        <TaskSteps steps={state.steps} status={state.status} />
      )}

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
