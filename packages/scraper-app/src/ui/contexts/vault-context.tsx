import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

type VaultContextValue = {
  locked: boolean;
  hasFile: boolean;
  unlock(password: string): Promise<'ok' | 'wrong-password' | 'not-found'>;
  create(password: string, serverUrl: string, apiKey: string): Promise<void>;
};

export const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }): ReactElement {
  const [locked, setLocked] = useState(true);
  const [hasFile, setHasFile] = useState(false);

  useEffect(() => {
    fetch('/api/vault/status')
      .then(r => r.json() as Promise<{ locked: boolean; hasFile: boolean }>)
      .then(s => {
        setLocked(s.locked);
        setHasFile(s.hasFile);
      })
      .catch(() => {});
  }, []);

  const unlock = useCallback(async (password: string) => {
    const res = await fetch('/api/vault/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setLocked(false);
      return 'ok' as const;
    }
    return res.status === 404 ? ('not-found' as const) : ('wrong-password' as const);
  }, []);

  const create = useCallback(async (password: string, serverUrl: string, apiKey: string) => {
    const res = await fetch('/api/vault/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, serverUrl, apiKey }),
    });
    if (!res.ok) {
      throw new Error('Failed to create vault');
    }
    setLocked(false);
    setHasFile(true);
  }, []);

  return (
    <VaultContext.Provider value={{ locked, hasFile, unlock, create }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside VaultProvider');
  return ctx;
}
