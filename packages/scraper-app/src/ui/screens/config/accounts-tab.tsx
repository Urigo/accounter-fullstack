import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AccountRecord } from '../../../server/vault.js';
import { deleteAccount, fetchAccounts, updateStatus } from '../../lib/api.js';
import { SOURCE_LABELS } from './source-types.js';

type SourceType = 'poalim' | 'discount' | 'isracard' | 'amex' | 'cal' | 'max';
type AccountStatus = 'accepted' | 'ignored' | 'pending';

const STATUS_COLORS: Record<AccountStatus, string> = {
  accepted: '#2a7a2a',
  ignored: '#999',
  pending: '#b85c00',
};

function StatusBadge({ status }: { status: AccountStatus }): ReactElement {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: '0.8em',
        color: '#fff',
        background: STATUS_COLORS[status],
      }}
    >
      {status}
    </span>
  );
}

type AccountRowProps = {
  account: AccountRecord;
  onStatusChange(id: string, status: 'accepted' | 'ignored'): void;
  onDelete(id: string): void;
};

function AccountRow({ account, onStatusChange, onDelete }: AccountRowProps): ReactElement {
  const label = account.branchNumber
    ? `${account.accountNumber} / branch ${account.branchNumber}`
    : account.accountNumber;

  return (
    <li
      style={{
        padding: '8px 0',
        borderBottom: '1px solid #eee',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1 }}>{label}</span>
        <StatusBadge status={account.status} />
        <select
          aria-label={`Status for ${label}`}
          value={account.status}
          onChange={e => {
            const v = e.target.value as 'accepted' | 'ignored';
            if (v === 'accepted' || v === 'ignored') onStatusChange(account.id, v);
          }}
        >
          <option value="pending">pending</option>
          <option value="accepted">accepted</option>
          <option value="ignored">ignored</option>
        </select>
        <button
          aria-label={`Delete ${label}`}
          onClick={() => onDelete(account.id)}
          style={{
            color: '#c00',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          ✕
        </button>
      </div>
      {account.status === 'pending' && (
        <p style={{ margin: '4px 0 0', fontSize: '0.85em', color: '#b85c00' }}>
          Visit the Accounter client to set up this account.
        </p>
      )}
    </li>
  );
}

export function AccountsTab(): ReactElement {
  const [accounts, setAccounts] = useState<(AccountRecord & { nickname?: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      setAccounts(await fetchAccounts());
    } catch {
      setError('Failed to load accounts');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusChange(id: string, status: 'accepted' | 'ignored') {
    try {
      setAccounts(await updateStatus(id, status));
    } catch {
      setError('Failed to update account');
    }
  }

  async function handleDelete(id: string) {
    try {
      setAccounts(await deleteAccount(id));
    } catch {
      setError('Failed to delete account');
    }
  }

  const grouped = useMemo(
    () =>
      accounts.reduce<Record<string, (AccountRecord & { nickname?: string })[]>>((acc, a) => {
        const key = `${a.sourceType}:${a.nickname ?? a.sourceId}`;
        acc[key] ||= [];
        acc[key].push(a);
        return acc;
      }, {}),
    [accounts],
  );

  const pending = useMemo(() => accounts.filter(a => a.status === 'pending'), [accounts]);

  const sections = useMemo(() => {
    if (pendingOnly) {
      return [{ key: 'pending', label: 'Pending accounts', accounts: pending }];
    }
    return Object.entries(grouped).map(([key, accs]) => {
      const [sourceType, sourceId] = key.split(':') as [SourceType, string];
      return {
        key,
        label: `${SOURCE_LABELS[sourceType]} (${sourceId})`,
        accounts: accs,
      };
    });
  }, [pendingOnly, pending, grouped]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Account Records</h2>
        {pending.length > 0 && (
          <button onClick={() => setPendingOnly(p => !p)} style={{ fontSize: '0.85em' }}>
            {pendingOnly ? 'Show all' : `Classify ${pending.length} pending`}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {accounts.length === 0 && (
        <p>No account records discovered yet. Run a scrape to populate this list.</p>
      )}

      {sections.map(section => (
        <section key={section.key} style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 6 }}>{section.label}</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {section.accounts.map(a => (
              <AccountRow
                key={a.id}
                account={a}
                onStatusChange={(id, status) => void handleStatusChange(id, status)}
                onDelete={id => void handleDelete(id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
