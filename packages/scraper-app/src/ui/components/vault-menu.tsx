import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useVault } from '../contexts/vault-context.js';
import { ChevronDownIcon, DownloadIcon, LockIcon, SaveIcon } from './icons.js';

/** The vault file chip in the app header: name, saved state, and file actions. */
export function VaultMenu(): ReactElement {
  const vault = useVault();
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
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
    if (!open) setConfirmClose(false);
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
        <ChevronDownIcon size={14} />
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
            onClick={() => act(vault.save)}
          >
            <SaveIcon size={16} />
            {vault.saveMode === 'download' ? 'Download updated vault' : 'Save'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => act(vault.downloadCopy)}
          >
            <DownloadIcon size={16} /> Download a copy
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
                  onClick={() => act(vault.close)}
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
              onClick={() => (dirty ? setConfirmClose(true) : act(vault.close))}
            >
              <LockIcon size={16} /> Close vault
            </button>
          )}
        </div>
      )}
    </div>
  );
}
