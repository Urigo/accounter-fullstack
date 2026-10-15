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

/**
 * - `downloaded`: the browser was handed the file, which doesn't prove it was kept. The session
 *   stays unsaved until the user confirms with `confirmDownloaded()`.
 * - `session-changed`: the vault this tab was showing was closed or replaced (e.g. in another
 *   tab), so nothing was written.
 */
export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled' | 'denied' | 'session-changed';

export type VaultContextValue = {
  phase: VaultPhase;
  error: string | null;
  /** The file chosen on the welcome screen, before it is unlocked. */
  picked: PickedVaultFile | null;
  fileName: string | null;
  origin: 'new' | 'opened' | null;
  changes: VaultChanges | null;
  saveMode: SaveMode;
  /** A save is in progress (saves are serialized, so further clicks queue behind it). */
  saving: boolean;
  /** An updated vault was downloaded and is waiting for the user to confirm they kept it. */
  pendingDownload: boolean;
  chooseFile(picked: PickedVaultFile): void;
  startCreate(): void;
  backToWelcome(): void;
  open(password: string): Promise<void>;
  create(password: string, serverUrl: string, apiKey: string): Promise<boolean>;
  finishSetup(): void;
  save(): Promise<SaveOutcome>;
  confirmDownloaded(): Promise<void>;
  downloadCopy(): Promise<void>;
  /** Rejects (keeping the session) when the server refuses, e.g. while a scrape is running. */
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
  const [saving, setSaving] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // The server session this tab is working with. Saves name it, so a tab whose session was
  // closed elsewhere can't write another vault into the file it holds a handle to.
  const sessionIdRef = useRef<string | null>(null);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());

  const adoptHandle = useCallback((h: FileSystemFileHandle | null) => {
    setHandle(h);
    void rememberHandle(h, sessionIdRef.current);
  }, []);

  const resetSession = useCallback(() => {
    sessionIdRef.current = null;
    adoptHandle(null);
    setPendingDownload(null);
    setChanges(null);
    setFileName(null);
    setOrigin(null);
    setPicked(null);
  }, [adoptHandle]);

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
        sessionIdRef.current = s.sessionId;
        setFileName(s.fileName);
        setOrigin(s.origin);
        setChanges(s.changes);
        // The server session survived a page reload; try to get the file handle back too.
        setHandle(await recallHandle(s.sessionId));
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

  // Changes live only in this session; warn before the tab is closed with unsaved work. A new
  // vault is dirty already on the wizard's final "save your file" step.
  const dirty = (phase === 'unlocked' || phase === 'creating') && !!changes?.dirty;
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
        sessionIdRef.current = (await apiOpen(blob, password, picked.file.name)).sessionId;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setError(
            'Another vault is already open in this app, maybe in another tab. Reload the page to ' +
              'continue with it, or close it there first.',
          );
        } else if (e instanceof ApiError && e.status === 401) {
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
        sessionIdRef.current = (await apiCreate(password, serverUrl, apiKey)).sessionId;
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

  const doSave = useCallback(async (): Promise<SaveOutcome> => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return 'session-changed';
    let exported: Awaited<ReturnType<typeof apiExport>>;
    try {
      exported = await apiExport(sessionId);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 401)) return 'session-changed';
      throw e;
    }
    const { blob, revision, fileName: name } = exported;
    let savedAs: string | undefined;

    if (handle) {
      if (!(await saveToHandle(handle, blob))) return 'denied';
    } else if (supportsSavePicker()) {
      const newHandle = await saveAsNew(blob, name);
      if (!newHandle) return 'cancelled';
      adoptHandle(newHandle);
      savedAs = newHandle.name;
    } else {
      // A download can be cancelled or blocked without us knowing, so it isn't acknowledged
      // until the user says they kept the file.
      downloadBlob(blob, name);
      setPendingDownload(revision);
      return 'downloaded';
    }

    const res = await apiMarkSaved(sessionId, revision, savedAs);
    setChanges(res.changes);
    setPendingDownload(null);
    if (savedAs) setFileName(savedAs);
    return 'saved';
  }, [handle, adoptHandle]);

  // One save at a time, whether it starts from the banner, the header menu or the wizard:
  // overlapping writes could finish out of order and leave an older revision in the file.
  const save = useCallback((): Promise<SaveOutcome> => {
    const run = saveChain.current.then(async () => {
      setSaving(true);
      try {
        return await doSave();
      } finally {
        setSaving(false);
      }
    });
    saveChain.current = run.catch(() => undefined);
    return run;
  }, [doSave]);

  const confirmDownloaded = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (pendingDownload === null || !sessionId) return;
    const res = await apiMarkSaved(sessionId, pendingDownload);
    setChanges(res.changes);
    setPendingDownload(null);
  }, [pendingDownload]);

  const downloadCopy = useCallback(async () => {
    // A copy never replaces the user's vault file, so it doesn't clear the unsaved state.
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const { blob, fileName: name } = await apiExport(sessionId);
    downloadBlob(blob, name);
  }, []);

  const close = useCallback(async () => {
    // Only forget the session once the server has: otherwise it keeps the decrypted vault while
    // this tab shows the welcome screen.
    await apiClose();
    resetSession();
    setError(null);
    setPhase('welcome');
  }, [resetSession]);

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
        saving,
        pendingDownload: pendingDownload !== null,
        chooseFile,
        startCreate,
        backToWelcome,
        open,
        create,
        finishSetup,
        save,
        confirmDownloaded,
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
