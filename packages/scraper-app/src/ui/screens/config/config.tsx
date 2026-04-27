import { useState, type ReactElement } from 'react';
import { AccountsTab } from './accounts-tab.js';
import { SettingsTab } from './settings-tab.js';
import { SourcesTab } from './sources-tab.js';

type TabId = 'sources' | 'accounts' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'settings', label: 'Settings' },
];

export function Config(): ReactElement {
  const [active, setActive] = useState<TabId>('sources');

  return (
    <div>
      <nav
        role="tablist"
        style={{ display: 'flex', gap: 4, borderBottom: '2px solid #ddd', marginBottom: 20 }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: active === t.id ? '2px solid #333' : '2px solid transparent',
              fontWeight: active === t.id ? 'bold' : 'normal',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {active === 'sources' && <SourcesTab />}
        {active === 'accounts' && <AccountsTab />}
        {active === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
