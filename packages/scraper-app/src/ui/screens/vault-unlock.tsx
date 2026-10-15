import { useState, type ReactElement } from 'react';
import { ArrowLeft, CircleAlert, FileIcon, Lock } from 'lucide-react';
import { useVault } from '../contexts/vault-context.js';
import { formatFileSize } from '../lib/vault-file.js';

export function VaultUnlock(): ReactElement {
  const vault = useVault();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await vault.open(password);
    setLoading(false);
  }

  const file = vault.picked?.file;

  return (
    <main className="onboarding">
      <div className="onboarding-inner onboarding-narrow">
        <button type="button" className="back-link" onClick={vault.backToWelcome}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="card stack">
          <div className="row">
            <div className="choice-icon" style={{ marginBottom: 0 }}>
              <Lock size={18} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Unlock your vault</h1>
              <p className="muted small" style={{ margin: 0 }}>
                The file is decrypted in memory. It is not copied to this machine.
              </p>
            </div>
          </div>

          {file && (
            <div className="file-chip">
              <FileIcon size={18} style={{ flex: 'none', color: 'var(--text-muted)' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="file-chip-name">{file.name}</div>
                <div className="muted small">{formatFileSize(file.size)}</div>
              </div>
              <button type="button" className="btn btn-ghost" onClick={vault.backToWelcome}>
                Change
              </button>
            </div>
          )}

          <form className="stack" onSubmit={e => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="password">Master password</label>
              <div className="input-group">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  aria-invalid={!!vault.error}
                  aria-describedby={vault.error ? 'unlock-error' : undefined}
                  autoComplete="current-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-ghost input-addon"
                  onClick={() => setShowPassword(s => !s)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {vault.error && (
                <p id="unlock-error" role="alert" className="field-error">
                  <CircleAlert size={16} style={{ flex: 'none', marginTop: 1 }} />
                  {vault.error}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={loading || !password}
            >
              {loading ? 'Unlocking…' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
