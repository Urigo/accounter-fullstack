import { useEffect, useState, type ReactElement } from 'react';
import { Check, ChevronDown, Download, Save } from 'lucide-react';
import { useVault, type SaveOutcome } from '../contexts/vault-context.js';
import {
  describeChange,
  describeKind,
  groupChanges,
  KIND_MARKS,
  SECTION_LABELS,
} from '../lib/change-labels.js';

function saveLabel(mode: 'in-place' | 'save-as' | 'download', fileName: string): string {
  if (mode === 'in-place') return `Save to ${fileName}`;
  if (mode === 'save-as') return 'Save vault file…';
  return 'Download updated vault';
}

/**
 * Shown above the tabs whenever the session holds changes that the user's vault file doesn't,
 * so it is visible from Run, History and Config alike.
 */
export function UnsavedBanner(): ReactElement | null {
  const vault = useVault();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaveOutcome | 'error' | null>(null);

  // The success toast fades on its own; errors stay until the next attempt.
  useEffect(() => {
    if (result !== 'saved') return;
    const t = setTimeout(() => setResult(null), 3500);
    return () => clearTimeout(t);
  }, [result]);

  const changes = vault.changes;
  const fileName = vault.fileName ?? 'vault file';

  async function run(action: () => Promise<SaveOutcome | void>) {
    setBusy(true);
    setResult(null);
    try {
      const outcome = await action();
      if (outcome) setResult(outcome);
      if (outcome === 'saved') setExpanded(false);
    } catch {
      setResult('error');
    } finally {
      setBusy(false);
    }
  }

  if (!changes?.dirty) {
    if (result === 'saved') {
      return (
        <div className="toast" role="status">
          <Check size={16} />
          Saved to {fileName}
        </div>
      );
    }
    return null;
  }

  const disabled = busy || vault.saving;

  const count = changes.items.length;
  const groups = groupChanges(changes);
  const title = changes.neverSaved
    ? 'This vault hasn’t been saved to a file yet'
    : `${count} unsaved ${count === 1 ? 'change' : 'changes'} to ${fileName}`;

  return (
    <>
      <section className="banner" aria-label="Unsaved vault changes" aria-live="polite">
        <div className="banner-main">
          <div className="banner-text">
            <p className="banner-title">
              <span
                className="status-dot"
                data-state="unsaved"
                style={{ display: 'inline-block', marginRight: 8 }}
              />
              {title}
            </p>
            <p className="banner-sub">
              Changes are kept only for this session. Save them before you close the app.
              {groups.length > 0 && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setExpanded(e => !e)}
                    aria-expanded={expanded}
                    aria-controls="unsaved-details"
                  >
                    {expanded ? 'Hide changes' : 'Review changes'}
                    <ChevronDown
                      size={14}
                      style={{
                        verticalAlign: 'middle',
                        transform: expanded ? 'rotate(180deg)' : undefined,
                      }}
                    />
                  </button>
                </>
              )}
            </p>
          </div>
          <div className="banner-actions">
            {vault.saveMode !== 'download' && (
              <button
                type="button"
                className="btn"
                disabled={disabled}
                onClick={() => void run(vault.downloadCopy)}
              >
                <Download size={16} /> Download copy
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={disabled}
              onClick={() => void run(vault.save)}
            >
              <Save size={16} />
              {vault.saving ? 'Saving…' : saveLabel(vault.saveMode, fileName)}
            </button>
          </div>
        </div>

        {vault.pendingDownload && (
          <div className="banner-confirm">
            <p className="small" style={{ margin: 0 }}>
              {changes.neverSaved
                ? `Downloaded ${fileName}. Once it is somewhere safe, confirm it here.`
                : `Downloaded ${fileName}. Once it has replaced your old vault file, confirm it here.`}
            </p>
            <button
              type="button"
              className="btn"
              disabled={disabled}
              onClick={() =>
                void run(async () => {
                  await vault.confirmDownloaded();
                  return 'saved';
                })
              }
            >
              <Check size={16} /> {changes.neverSaved ? 'I’ve kept it' : 'I’ve replaced it'}
            </button>
          </div>
        )}

        {expanded && (
          <div id="unsaved-details" className="banner-details">
            {groups.map(g => (
              <div key={g.section} className="change-group">
                <h3>{SECTION_LABELS[g.section]}</h3>
                <ul>
                  {g.items.map(item => (
                    <li key={`${item.section}:${item.id}`} className="pill">
                      <span className="change-mark" aria-hidden="true">
                        {KIND_MARKS[item.kind]}
                      </span>
                      {describeChange(item)}
                      <span className="visually-hidden"> ({describeKind(item)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {vault.saveMode === 'download' && (
              <p className="muted small" style={{ margin: '12px 0 0' }}>
                Your browser can’t overwrite files, so the updated vault is downloaded instead.
                Replace your old vault file with it.
              </p>
            )}
          </div>
        )}
      </section>
      {result === 'error' && (
        <p role="alert" className="inline-error">
          Could not save the vault. Please try again.
        </p>
      )}
      {result === 'session-changed' && (
        <p role="alert" className="inline-error">
          This vault was closed or replaced in another tab, so nothing was saved. Reload the page.
        </p>
      )}
      {result === 'denied' && (
        <p role="alert" className="inline-error">
          The browser was not allowed to write to {fileName}. Allow it, or use Download copy.
        </p>
      )}
    </>
  );
}
