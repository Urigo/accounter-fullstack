import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ChevronDown, Download, Lock, Save } from 'lucide-react';
import { useVault, type SaveOutcome } from '../contexts/vault-context.js';
import { ApiError } from '../lib/api.js';

/** The vault file chip in the app header: name, saved state, and file actions. */
export function VaultMenu(): ReactElement {
  const vault = useVault();
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setConfirmClose(false);
      setMenuError(null);
    }
  }, [open]);

  const dirty = !!vault.changes?.dirty;
  const stateLabel = vault.changes?.neverSaved
    ? 'Not saved yet'
    : dirty
      ? 'Unsaved changes'
      : 'All changes saved';

  const fileName = vault.fileName ?? 'the vault file';
  const SAVE_FAILURES: Partial<Record<SaveOutcome, string>> = {
    denied: `The browser was not allowed to write to ${fileName}. Allow it, or download a copy.`,
    'session-changed': 'This vault was closed or replaced in another tab. Reload the page.',
  };

  // Each action closes the menu when it works, and stays open with the reason when it doesn't.
  async function save() {
    setMenuError(null);
    try {
      const failure = SAVE_FAILURES[await vault.save()];
      if (failure) setMenuError(failure);
      else setOpen(false);
    } catch {
      setMenuError('Could not save the vault. Please try again.');
    }
  }

  async function downloadCopy() {
    setMenuError(null);
    try {
      await vault.downloadCopy();
      setOpen(false);
    } catch {
      setMenuError('Could not download a copy. Please try again.');
    }
  }

  async function closeVault(discardChanges: boolean) {
    setMenuError(null);
    try {
      await vault.close(discardChanges);
    } catch (e) {
      const code = e instanceof ApiError ? e.message : null;
      // Changes this tab hadn't heard of (made in another tab): ask before discarding them.
      setConfirmClose(code === 'unsaved-changes');
      if (code === 'unsaved-changes') return;
      setMenuError(
        code === 'run-in-progress'
          ? 'A scrape is running. Close the vault after it finishes.'
          : code === 'session-changed'
            ? 'This vault was already closed in another tab.'
            : 'Could not close the vault. Please try again.',
      );
    }
  }

  return (
    <div className="vault-menu" ref={rootRef}>
      <button
        type="button"
        className="vault-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Vault ${vault.fileName ?? ''}: ${stateLabel}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="status-dot" data-state={dirty ? 'unsaved' : 'saved'} />
        <span className="vault-chip-name">{vault.fileName}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="menu" role="menu">
          <div className="menu-header">
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{vault.fileName}</div>
            {stateLabel}
          </div>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={vault.saving}
            onClick={() => void save()}
          >
            <Save size={16} />
            {vault.saveMode === 'download' ? 'Download updated vault' : 'Save'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => void downloadCopy()}
          >
            <Download size={16} /> Download a copy
          </button>
          <div className="menu-sep" />
          {confirmClose ? (
            <div style={{ padding: '6px 10px 4px' }}>
              <p className="small" style={{ margin: '0 0 8px' }}>
                Close without saving? Your unsaved changes will be lost.
              </p>
              <div className="row">
                <button type="button" className="btn" onClick={() => setConfirmClose(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={() => void closeVault(true)}
                >
                  Close vault
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="menu-item menu-item-danger"
              onClick={() => (dirty ? setConfirmClose(true) : void closeVault(false))}
            >
              <Lock size={16} /> Close vault
            </button>
          )}
          {menuError && (
            <p role="alert" className="inline-error small" style={{ margin: '4px 10px 6px' }}>
              {menuError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
