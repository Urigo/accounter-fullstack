import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ErrorBoundary } from './components/error-boundary.js';
import { UnsavedBanner } from './components/unsaved-banner.js';
import { VaultMenu } from './components/vault-menu.js';
import { useVault, VaultProvider } from './contexts/vault-context.js';
import { useRunSocket } from './lib/ws.js';
import { Config } from './screens/config/config.js';
import { History } from './screens/history.js';
import { Run } from './screens/run.js';
import { VaultSetup } from './screens/vault-setup.js';
import { VaultUnlock } from './screens/vault-unlock.js';
import { Welcome } from './screens/welcome.js';

export { VaultContext } from './contexts/vault-context.js';

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
  const { phase } = useVault();

  if (phase === 'loading') return <div className="onboarding muted">Loading…</div>;
  if (phase === 'welcome')
    return (
      <ErrorBoundary label="Welcome">
        <Welcome />
      </ErrorBoundary>
    );
  if (phase === 'unlocking')
    return (
      <ErrorBoundary label="VaultUnlock">
        <VaultUnlock />
      </ErrorBoundary>
    );
  if (phase === 'creating')
    return (
      <ErrorBoundary label="VaultSetup">
        <VaultSetup />
      </ErrorBoundary>
    );

  return (
    <ErrorBoundary label="App">
      <AppUnlocked />
    </ErrorBoundary>
  );
}

/**
 * Account discovery adds records to the vault while a run is in progress. Counts how many the
 * latest run added, so the Run tab can point at them.
 */
function useDiscoveredAccounts(runStatus: string): number {
  const { changes, refreshChanges } = useVault();
  const added =
    changes?.items.filter(i => i.section === 'accounts' && i.kind === 'added').length ?? 0;
  const atRunStart = useRef<number | null>(null);
  const [discovered, setDiscovered] = useState(0);

  useEffect(() => {
    if (runStatus === 'running') {
      atRunStart.current = added;
      setDiscovered(0);
    }
    if (runStatus === 'complete') void refreshChanges();
    // Only react to run transitions; `added` is read at the moment the run starts.
  }, [runStatus]);

  useEffect(() => {
    if (runStatus === 'complete' && atRunStart.current !== null) {
      setDiscovered(Math.max(0, added - atRunStart.current));
    }
  }, [runStatus, added]);

  return discovered;
}

function AppUnlocked(): ReactElement {
  const [tab, setTab] = useState<AppTab>('run');
  const socket = useRunSocket();
  const { changes } = useVault();
  const discoveredAccounts = useDiscoveredAccounts(socket.runStatus);
  // Every tracked change belongs to a Config section (credentials, accounts, settings).
  const configChanged = (changes?.items.length ?? 0) > 0;

  return (
    <main className="page">
      <header className="app-header">
        <h1 className="app-title">Accounter Scraper</h1>
        <span className="spacer" />
        <VaultMenu />
      </header>

      <UnsavedBanner />

      <nav role="tablist" className="tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            className="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'run' && socket.runStatus === 'running' && (
              <span className="tab-dot tab-dot-running" aria-label="running" />
            )}
            {id === 'config' && configChanged && (
              <span className="tab-dot" aria-label="has unsaved changes" />
            )}
          </button>
        ))}
      </nav>

      {/* Always mounted — visibility toggled via CSS so WS state survives tab switches */}
      <div style={hidden(tab === 'run')}>
        <ErrorBoundary label="Run">
          <Run
            {...socket}
            onNavigateAccounts={() => setTab('config')}
            isVisible={tab === 'run'}
            discoveredAccounts={discoveredAccounts}
          />
        </ErrorBoundary>
      </div>
      {tab === 'history' && (
        <ErrorBoundary label="History">
          <History onNavigateSettings={() => setTab('config')} />
        </ErrorBoundary>
      )}
      {tab === 'config' && (
        <ErrorBoundary label="Config">
          <Config />
        </ErrorBoundary>
      )}
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
