import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { VaultChanges } from '../../shared/types.js';
import {
  vaultChanges as apiChanges,
  vaultClose as apiClose,
  vaultCreate as apiCreate,
  ApiError,
  vaultExport as apiExport,
  vaultMarkSaved as apiMarkSaved,
  vaultOpen as apiOpen,
  vaultStatus as apiStatus,
  vaultEvents,
} from '../lib/api.js';
import {
  downloadBlob,
  recallHandle,
  rememberHandle,
  saveAsNew,
  saveToHandle,
  supportsSavePicker,
  type PickedVaultFile,
} from '../lib/vault-file.js';

/**
 * - `welcome`: no vault in this session — choose to open one or create one
 * - `unlocking`: a file was picked and is waiting for its password
 * - `creating`: the new-vault wizard (it stays here through its final "save your file" step)
 */
export type VaultPhase = 'loading' | 'welcome' | 'unlocking' | 'creating' | 'unlocked';

/** How "Save" will store the vault: overwrite the opened file, ask where, or download. */
export type SaveMode = 'in-place' | 'save-as' | 'download';

export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled' | 'denied';

export type VaultContextValue = {
  phase: VaultPhase;
  error: string | null;
  /** The file chosen on the welcome screen, before it is unlocked. */
  picked: PickedVaultFile | null;
  fileName: string | null;
  origin: 'new' | 'opened' | null;
  changes: VaultChanges | null;
  saveMode: SaveMode;
  chooseFile(picked: PickedVaultFile): void;
  startCreate(): void;
  backToWelcome(): void;
  open(password: string): Promise<void>;
  create(password: string, serverUrl: string, apiKey: string): Promise<boolean>;
  finishSetup(): void;
  save(): Promise<SaveOutcome>;
  downloadCopy(): Promise<void>;
  close(): Promise<void>;
  refreshChanges(): Promise<void>;
};

export const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }): ReactElement {
  const [phase, setPhase] = useState<VaultPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedVaultFile | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [origin, setOrigin] = useState<'new' | 'opened' | null>(null);
  const [changes, setChanges] = useState<VaultChanges | null>(null);
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const adoptHandle = useCallback((h: FileSystemFileHandle | null) => {
    setHandle(h);
    void rememberHandle(h);
  }, []);

  const refreshChanges = useCallback(async () => {
    try {
      setChanges(await apiChanges());
    } catch {
      // Locked or unreachable — keep whatever we last knew.
    }
  }, []);

  useEffect(() => {
    apiStatus()
      .then(async s => {
        if (s.state === 'empty') {
          setPhase('welcome');
          return;
        }
        setFileName(s.fileName);
        setOrigin(s.origin);
        setChanges(s.changes);
        // The server session survived a page reload; try to get the file handle back too.
        const remembered = await recallHandle();
        if (remembered && remembered.name === s.fileName) setHandle(remembered);
        setPhase('unlocked');
      })
      .catch(() => setPhase('welcome'));
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (phaseRef.current === 'unlocked' || phaseRef.current === 'creating') {
        void refreshChanges();
      }
    };
    vaultEvents.addEventListener('vault-changed', onChange);
    return () => vaultEvents.removeEventListener('vault-changed', onChange);
  }, [refreshChanges]);

  // Changes live only in this session; warn before the tab is closed with unsaved work.
  const dirty = phase === 'unlocked' && !!changes?.dirty;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const chooseFile = useCallback((p: PickedVaultFile) => {
    setError(null);
    setPicked(p);
    setPhase('unlocking');
  }, []);

  const startCreate = useCallback(() => {
    setError(null);
    setPhase('creating');
  }, []);

  const backToWelcome = useCallback(() => {
    setError(null);
    setPicked(null);
    setPhase('welcome');
  }, []);

  const open = useCallback(
    async (password: string) => {
      if (!picked) return;
      setError(null);
      try {
        const blob = await picked.file.text();
        await apiOpen(blob, password, picked.file.name);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setError('Wrong password. Please try again.');
        } else if (e instanceof ApiError && e.status === 400) {
          setError("This file doesn't look like an Accounter vault. Try a different file.");
        } else {
          setError('Could not open the vault. Please try again.');
        }
        return;
      }
      setFileName(picked.file.name);
      setOrigin('opened');
      adoptHandle(picked.handle);
      setPicked(null);
      await refreshChanges();
      setPhase('unlocked');
    },
    [picked, adoptHandle, refreshChanges],
  );

  const create = useCallback(
    async (password: string, serverUrl: string, apiKey: string) => {
      setError(null);
      try {
        await apiCreate(password, serverUrl, apiKey);
      } catch {
        setError('Failed to create vault. Please try again.');
        return false;
      }
      setOrigin('new');
      setFileName('accounter.vault');
      adoptHandle(null);
      await refreshChanges();
      return true;
    },
    [adoptHandle, refreshChanges],
  );

  const finishSetup = useCallback(() => setPhase('unlocked'), []);

  const saveMode: SaveMode = handle ? 'in-place' : supportsSavePicker() ? 'save-as' : 'download';

  const save = useCallback(async (): Promise<SaveOutcome> => {
    const { blob, revision, fileName: name } = await apiExport();
    let outcome: SaveOutcome;
    let savedAs: string | undefined;

    if (handle) {
      if (!(await saveToHandle(handle, blob))) return 'denied';
      outcome = 'saved';
    } else if (supportsSavePicker()) {
      const newHandle = await saveAsNew(blob, name);
      if (!newHandle) return 'cancelled';
      adoptHandle(newHandle);
      savedAs = newHandle.name;
      outcome = 'saved';
    } else {
      downloadBlob(blob, name);
      outcome = 'downloaded';
    }

    const res = await apiMarkSaved(revision, savedAs);
    setChanges(res.changes);
    if (savedAs) setFileName(savedAs);
    return outcome;
  }, [handle, adoptHandle]);

  const downloadCopy = useCallback(async () => {
    // A copy never replaces the user's vault file, so it doesn't clear the unsaved state.
    const { blob, fileName: name } = await apiExport();
    downloadBlob(blob, name);
  }, []);

  const close = useCallback(async () => {
    await apiClose().catch(() => undefined);
    adoptHandle(null);
    setChanges(null);
    setFileName(null);
    setOrigin(null);
    setPicked(null);
    setError(null);
    setPhase('welcome');
  }, [adoptHandle]);

  return (
    <VaultContext.Provider
      value={{
        phase,
        error,
        picked,
        fileName,
        origin,
        changes,
        saveMode,
        chooseFile,
        startCreate,
        backToWelcome,
        open,
        create,
        finishSetup,
        save,
        downloadCopy,
        close,
        refreshChanges,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside VaultProvider');
  return ctx;
}

/** Unsaved changes, or null outside a vault session (e.g. a screen rendered on its own). */
export function useVaultChanges(): VaultChanges | null {
  return useContext(VaultContext)?.changes ?? null;
}
