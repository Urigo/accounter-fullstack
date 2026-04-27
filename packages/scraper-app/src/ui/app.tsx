import { type ReactElement } from 'react';
import { useVault, VaultContext, VaultProvider } from './contexts/vault-context.js';
import { VaultSetup } from './screens/vault-setup.js';
import { VaultUnlock } from './screens/vault-unlock.js';

export { VaultContext };

function AppContent(): ReactElement {
  const { locked, hasFile } = useVault();
  if (!hasFile) return <VaultSetup />;
  if (locked) return <VaultUnlock />;
  return <main>Scraper App — ready</main>;
}

export function App(): ReactElement {
  return (
    <VaultProvider>
      <AppContent />
    </VaultProvider>
  );
}
