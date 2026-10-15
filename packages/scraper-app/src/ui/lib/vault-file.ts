// Browser-side handling of the user's vault file. Where the File System Access API is available
// (Chromium), we keep a handle to the file the user opened so "Save" can overwrite it in place.
// Elsewhere we fall back to a plain file input and downloads.

type FilePickerOptions = {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption?: boolean;
  multiple?: boolean;
};

type PermissionAwareHandle = FileSystemFileHandle & {
  queryPermission?(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  createWritable?(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
};

type FsAccessWindow = Window & {
  showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>;
};

export type PickedVaultFile = { file: File; handle: FileSystemFileHandle | null };

const PICKER_TYPES: FilePickerOptions['types'] = [
  { description: 'Accounter vault', accept: { 'application/octet-stream': ['.vault'] } },
];

function fsWindow(): FsAccessWindow {
  return window as FsAccessWindow;
}

export function supportsOpenPicker(): boolean {
  return typeof fsWindow().showOpenFilePicker === 'function';
}

export function supportsSavePicker(): boolean {
  return typeof fsWindow().showSaveFilePicker === 'function';
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Opens the native file picker. Resolves null when the user cancels. */
export async function pickVaultFile(): Promise<PickedVaultFile | null> {
  const picker = fsWindow().showOpenFilePicker;
  if (!picker) throw new Error('showOpenFilePicker is not supported');
  try {
    // Accept any file: older vaults are named `.vault`, which some pickers treat as hidden.
    const [handle] = await picker.call(window, { multiple: false });
    if (!handle) return null;
    return { file: await handle.getFile(), handle };
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

/** Reads a dropped file, with a writable handle when the browser can provide one. */
export async function fileFromDrop(dt: DataTransfer): Promise<PickedVaultFile | null> {
  const item = [...dt.items].find(i => i.kind === 'file');
  if (!item) return null;
  const withHandle = item as DataTransferItem & {
    getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
  };
  // getAsFileSystemHandle must be called synchronously within the drop event.
  const handlePromise = withHandle.getAsFileSystemHandle?.();
  const file = item.getAsFile();
  if (!file) return null;
  const handle = await handlePromise?.catch(() => null);
  return { file, handle: handle?.kind === 'file' ? (handle as FileSystemFileHandle) : null };
}

async function ensureWritable(handle: PermissionAwareHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/** Overwrites the file behind `handle`. Returns false when the user denies write access. */
export async function saveToHandle(
  handle: FileSystemFileHandle,
  contents: string,
): Promise<boolean> {
  const h = handle as PermissionAwareHandle;
  if (!h.createWritable || !(await ensureWritable(h))) return false;
  const writable = await h.createWritable();
  await writable.write(contents);
  await writable.close();
  return true;
}

/** Asks where to save a new file. Resolves null when the user cancels. */
export async function saveAsNew(
  contents: string,
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  const picker = fsWindow().showSaveFilePicker;
  if (!picker) throw new Error('showSaveFilePicker is not supported');
  try {
    const handle = await picker.call(window, { suggestedName, types: PICKER_TYPES });
    const saved = await saveToHandle(handle, contents);
    return saved ? handle : null;
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

export function downloadBlob(contents: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Remember the handle across page reloads ──────────────────────────────────
// The server keeps the session across reloads, so the handle should survive too. Handles are
// structured-cloneable and can be stored in IndexedDB. Everything here is best-effort.

const DB_NAME = 'accounter-scraper';
const STORE = 'handles';
const KEY = 'vault';

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const db = open.result;
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => {
            resolve(req.result as T);
            db.close();
          };
          req.onerror = () => {
            resolve(null);
            db.close();
          };
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

export async function rememberHandle(handle: FileSystemFileHandle | null): Promise<void> {
  await withStore('readwrite', store => (handle ? store.put(handle, KEY) : store.delete(KEY)));
}

export async function recallHandle(): Promise<FileSystemFileHandle | null> {
  const handle = await withStore<unknown>('readonly', store => store.get(KEY));
  return handle && typeof handle === 'object' && 'getFile' in handle
    ? (handle as FileSystemFileHandle)
    : null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
