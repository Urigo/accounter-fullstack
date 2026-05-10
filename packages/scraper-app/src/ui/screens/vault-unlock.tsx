import { useRef, useState, type ReactElement } from 'react';
import { useVault } from '../contexts/vault-context.js';
import { ApiError } from '../lib/api.js';

export function VaultUnlock(): ReactElement {
  const vault = useVault();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await vault.unlock(password);
    setLoading(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      await vault.upload(file);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // 409: vault exists, ask to overwrite
        const confirmed = window.confirm(
          'A vault already exists. Replace it with the uploaded file?',
        );
        if (confirmed) {
          try {
            await vault.upload(file, true);
          } catch {
            setUploadError('Failed to replace vault. Please try again.');
          }
        }
      }
    }
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <h1>Unlock Vault</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password">Master password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>
        {vault.error && <p role="alert">{vault.error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
      <hr />
      <div>
        <label htmlFor="vault-upload">or upload a different vault</label>
        <input ref={fileInputRef} id="vault-upload" type="file" onChange={handleFileChange} />
        {uploadError && <p role="alert">{uploadError}</p>}
      </div>
    </div>
  );
}
