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
  /**
   * Rejects (keeping the session) when the server refuses: a scrape is running, or the vault has
   * unsaved changes and `discardChanges` wasn't set.
   */
  close(discardChanges?: boolean): Promise<void>;
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

  // Change reports can arrive out of order (a refresh, a save, another tab). Each request takes a
  // sequence number, and only the latest one may apply — so an older "clean" answer can't hide
  // newer unsaved edits.
  const changesSeq = useRef(0);

  const applyChanges = useCallback((next: VaultChanges) => {
    changesSeq.current += 1;
    setChanges(next);
  }, []);

  const refreshChanges = useCallback(async () => {
    const seq = ++changesSeq.current;
    const sessionId = sessionIdRef.current;
    try {
      const next = await apiChanges();
      if (seq === changesSeq.current && sessionId === sessionIdRef.current) setChanges(next);
    } catch {
      // Locked or unreachable — keep whatever we last knew.
    }
  }, []);

  /**
   * The session is shared by every tab. Re-reads it when another tab changed something (or this
   * tab regains focus) and follows along: new changes, a save, or a close and re-open elsewhere.
   */
  const syncWithServer = useCallback(async () => {
    if (phaseRef.current !== 'unlocked') return;
    const seq = ++changesSeq.current;
    const sessionId = sessionIdRef.current;
    let status: Awaited<ReturnType<typeof apiStatus>>;
    try {
      status = await apiStatus();
    } catch {
      return;
    }
    if (
      seq !== changesSeq.current ||
      sessionId !== sessionIdRef.current ||
      phaseRef.current !== 'unlocked'
    ) {
      return;
    }
    if (status.state === 'empty') {
      resetSession();
      setPhase('welcome');
      return;
    }
    if (status.sessionId !== sessionId) {
      // Closed and replaced in another tab: drop this vault's file handle and pending download,
      // and show the vault that is open now.
      sessionIdRef.current = status.sessionId;
      setPendingDownload(null);
      setHandle(await recallHandle(status.sessionId));
    }
    setFileName(status.fileName);
    setOrigin(status.origin);
    setChanges(status.changes);
  }, [resetSession]);

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

  useEffect(() => {
    const sync = () => void syncWithServer();
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    vaultEvents.addEventListener('vault-remote', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      vaultEvents.removeEventListener('vault-remote', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [syncWithServer]);

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
    applyChanges(res.changes);
    setPendingDownload(null);
    if (savedAs) setFileName(savedAs);
    return 'saved';
  }, [handle, adoptHandle, applyChanges]);

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
    applyChanges(res.changes);
    setPendingDownload(null);
  }, [pendingDownload, applyChanges]);

  const downloadCopy = useCallback(async () => {
    // A copy never replaces the user's vault file, so it doesn't clear the unsaved state.
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const { blob, fileName: name } = await apiExport(sessionId);
    downloadBlob(blob, name);
  }, []);

  const close = useCallback(
    async (discardChanges = false) => {
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        // Only forget the session once the server has: otherwise it keeps the decrypted vault
        // while this tab shows the welcome screen. The server also checks for unsaved changes
        // itself, since another tab may have made some that this one hasn't heard of yet.
        try {
          await apiClose(sessionId, discardChanges);
        } catch (e) {
          if (e instanceof ApiError && e.message === 'session-changed') await syncWithServer();
          if (e instanceof ApiError && e.message === 'unsaved-changes') await refreshChanges();
          throw e;
        }
      }
      resetSession();
      setError(null);
      setPhase('welcome');
    },
    [resetSession, syncWithServer, refreshChanges],
  );

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
