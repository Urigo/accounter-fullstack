import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import { loadSettings, saveSettings } from '../../lib/api.js';
import { AccountsTab } from './accounts-tab.js';
import { SettingsTab } from './settings-tab.js';
import { SourcesTab } from './sources-tab.js';

type TabId = 'sources' | 'accounts' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sources', label: 'Credentials' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'settings', label: 'Settings' },
];

function ConnectionBar(): ReactElement {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then(s => {
      setServerUrl(s.serverUrl ?? '');
      setApiKey(s.apiKey ?? '');
    });
  }, []);

  function handleUrlBlur(e: ChangeEvent<HTMLInputElement>) {
    void saveSettings({ serverUrl: e.target.value || undefined });
  }

  function handleKeyBlur(e: ChangeEvent<HTMLInputElement>) {
    void saveSettings({ apiKey: e.target.value || undefined });
  }

  function handleTestConnection() {
    setToast('TODO: connection test not yet implemented');
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div
      style={{
        padding: '12px 0 16px',
        marginBottom: 16,
        borderBottom: '1px solid #ddd',
      }}
    >
      <h3 style={{ margin: '0 0 10px' }}>Server connection</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label
            htmlFor="conn-server-url"
            style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}
          >
            Server URL
          </label>
          <input
            id="conn-server-url"
            type="text"
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://your-accounter-server"
            style={{ padding: '4px 8px', width: 260 }}
          />
        </div>
        <div>
          <label
            htmlFor="conn-api-key"
            style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}
          >
            API Key
          </label>
          <input
            id="conn-api-key"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onBlur={handleKeyBlur}
            placeholder="your-api-key"
            style={{ padding: '4px 8px', width: 200 }}
          />
        </div>
        <button type="button" onClick={handleTestConnection}>
          Test connection
        </button>
      </div>
      {toast && (
        <p role="status" style={{ margin: '8px 0 0', fontSize: '0.85em', color: '#666' }}>
          {toast}
        </p>
      )}
    </div>
  );
}

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
        {active === 'sources' && (
          <>
            <ConnectionBar />
            <SourcesTab />
          </>
        )}
        {active === 'accounts' && <AccountsTab />}
        {active === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
