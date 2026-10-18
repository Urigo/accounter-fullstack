import { useRef, useState, type DragEvent, type ReactElement } from 'react';
import { ArrowRight, FolderOpen, Info, Lock, Sparkles } from 'lucide-react';
import { useVault } from '../contexts/vault-context.js';
import { fileFromDrop, pickVaultFile, supportsOpenPicker } from '../lib/vault-file.js';

export function Welcome(): ReactElement {
  const vault = useVault();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  async function handleChooseFile() {
    setPickError(null);
    if (!supportsOpenPicker()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const picked = await pickVaultFile();
      if (picked) vault.chooseFile(picked);
    } catch {
      // Some environments expose the API but refuse it (e.g. inside an iframe).
      fileInputRef.current?.click();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) vault.chooseFile({ file, handle: null });
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const picked = await fileFromDrop(e.dataTransfer);
    if (picked) vault.chooseFile(picked);
    else setPickError('Drop a single vault file.');
  }

  return (
    <main className="onboarding">
      <div className="onboarding-inner">
        <header className="brand">
          <div className="brand-mark">
            <Lock size={26} />
          </div>
          <h1>Accounter Scraper</h1>
          <p>
            Your bank credentials live in an encrypted vault file that you keep. This app never
            stores it. It is unlocked in memory for this session only.
          </p>
        </header>

        <div className="choice-grid">
          <section className="card choice" aria-labelledby="open-vault-title">
            <div className="choice-icon">
              <FolderOpen size={18} />
            </div>
            <h2 id="open-vault-title">Open my vault</h2>
            <p>I already have a vault file and its master password.</p>
            <div
              className="dropzone"
              data-active={dragging}
              onDragOver={e => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => void handleDrop(e)}
            >
              <span>Drop your vault file here</span>
              <span className="small">or</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleChooseFile()}
              >
                Choose file…
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="visually-hidden"
              tabIndex={-1}
              aria-label="Vault file"
              onChange={handleInputChange}
            />
            {pickError && (
              <p role="alert" className="field-error">
                {pickError}
              </p>
            )}
          </section>

          <section className="card choice" aria-labelledby="create-vault-title">
            <div className="choice-icon">
              <Sparkles size={18} />
            </div>
            <h2 id="create-vault-title">Create a new vault</h2>
            <p>
              First time here? Choose a master password and connect to your Accounter server. You’ll
              add bank credentials next.
            </p>
            <div className="choice-action">
              <button type="button" className="btn btn-lg btn-block" onClick={vault.startCreate}>
                Get started <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>

        <aside className="note">
          <Info size={18} style={{ flex: 'none', marginTop: 2 }} />
          <div>
            <strong>How saving works.</strong> Anything you change while working (new credentials,
            discovered accounts, settings) is kept for this session. Save it back to your vault file
            before you close the app, or it is lost. The app reminds you when there is something to
            save.
          </div>
        </aside>
      </div>
    </main>
  );
}
