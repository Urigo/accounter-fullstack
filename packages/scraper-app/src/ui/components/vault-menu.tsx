import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ChevronDown, Download, Lock, Save } from 'lucide-react';
import { useVault } from '../contexts/vault-context.js';
import { ApiError } from '../lib/api.js';

/** The vault file chip in the app header: name, saved state, and file actions. */
export function VaultMenu(): ReactElement {
  const vault = useVault();
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
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
      setCloseError(null);
    }
  }, [open]);

  const dirty = !!vault.changes?.dirty;
  const stateLabel = vault.changes?.neverSaved
    ? 'Not saved yet'
    : dirty
      ? 'Unsaved changes'
      : 'All changes saved';

  function act(fn: () => Promise<unknown>) {
    setOpen(false);
    void fn().catch(() => undefined);
  }

  // Stays open on failure: the session is still there, and the user should see why.
  async function closeVault() {
    setCloseError(null);
    try {
      await vault.close();
    } catch (e) {
      setConfirmClose(false);
      setCloseError(
        e instanceof ApiError && e.message === 'run-in-progress'
          ? 'A scrape is running. Close the vault after it finishes.'
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
            onClick={() => act(vault.save)}
          >
            <Save size={16} />
            {vault.saveMode === 'download' ? 'Download updated vault' : 'Save'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => act(vault.downloadCopy)}
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
                  onClick={() => void closeVault()}
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
              onClick={() => (dirty ? setConfirmClose(true) : void closeVault())}
            >
              <Lock size={16} /> Close vault
            </button>
          )}
          {closeError && (
            <p role="alert" className="inline-error small" style={{ margin: '4px 10px 6px' }}>
              {closeError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
