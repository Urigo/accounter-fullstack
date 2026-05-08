import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  vaultCreate as apiCreate,
  ApiError,
  vaultStatus as apiStatus,
  vaultUnlock as apiUnlock,
  vaultUpload,
} from '../lib/api.js';

export type VaultStatus = 'loading' | 'locked' | 'no-file' | 'unlocked';

type VaultContextValue = {
  status: VaultStatus;
  error: string | null;
  unlock(password: string): Promise<void>;
  create(password: string, serverUrl: string, apiKey: string): Promise<void>;
  upload(file: File, force?: boolean): Promise<void>;
};

export const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }): ReactElement {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiStatus()
      .then(s => {
        if (!s.hasFile) setStatus('no-file');
        else if (s.locked) setStatus('locked');
        else setStatus('unlocked');
      })
      .catch(() => setStatus('locked'));
  }, []);

  const unlock = useCallback(async (password: string) => {
    setError(null);
    try {
      await apiUnlock(password);
      setStatus('unlocked');
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'Vault not found.'
          : 'Wrong password. Please try again.',
      );
    }
  }, []);

  const create = useCallback(async (password: string, serverUrl: string, apiKey: string) => {
    setError(null);
    try {
      await apiCreate(password, serverUrl, apiKey);
      setStatus('unlocked');
    } catch {
      setError('Failed to create vault. Please try again.');
    }
  }, []);

  const upload = useCallback(async (file: File, force = false) => {
    setError(null);
    try {
      await vaultUpload(file, force);
      setStatus('locked');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Re-throw so the caller can handle the conflict (show confirm dialog)
        throw e;
      }
      setError('Failed to upload vault. Please try again.');
    }
  }, []);

  return (
    <VaultContext.Provider value={{ status, error, unlock, create, upload }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside VaultProvider');
  return ctx;
}
