import { useState, type ReactElement } from 'react';
import { useVault, VaultContext, VaultProvider } from './contexts/vault-context.js';
import { useRunSocket } from './lib/ws.js';
import { Config } from './screens/config/config.js';
import { History } from './screens/history.js';
import { Run } from './screens/run.js';
import { VaultSetup } from './screens/vault-setup.js';
import { VaultUnlock } from './screens/vault-unlock.js';

export { VaultContext };

type AppTab = 'run' | 'history' | 'config';

const TABS: { id: AppTab; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'history', label: 'History' },
  { id: 'config', label: 'Config' },
];

function hidden(visible: boolean): React.CSSProperties {
  return visible ? {} : { display: 'none' };
}

function AppContent(): ReactElement {
  const { status } = useVault();

  if (status === 'loading') return <div>Loading…</div>;
  if (status === 'no-file') return <VaultSetup />;
  if (status === 'locked') return <VaultUnlock />;

  return <AppUnlocked />;
}

function AppUnlocked(): ReactElement {
  const [tab, setTab] = useState<AppTab>('run');
  const socket = useRunSocket();

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <nav
        role="tablist"
        style={{ display: 'flex', gap: 4, borderBottom: '2px solid #ddd', marginBottom: 20 }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: tab === id ? '2px solid #333' : '2px solid transparent',
              fontWeight: tab === id ? 'bold' : 'normal',
              marginBottom: -2,
            }}
          >
            {label}
            {id === 'run' && socket.runStatus === 'running' && (
              <span style={{ marginLeft: 6, color: '#2563eb', fontSize: '0.75em' }}>●</span>
            )}
          </button>
        ))}
      </nav>

      {/* Always mounted — visibility toggled via CSS so WS state survives tab switches */}
      <div style={hidden(tab === 'run')}>
        <Run {...socket} onNavigateAccounts={() => setTab('config')} isVisible={tab === 'run'} />
      </div>
      <div style={hidden(tab === 'history')}>{tab === 'history' && <History />}</div>
      <div style={hidden(tab === 'config')}>{tab === 'config' && <Config />}</div>
    </main>
  );
}

export function App(): ReactElement {
  return (
    <VaultProvider>
      <AppContent />
    </VaultProvider>
  );
}
