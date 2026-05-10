import { useRef, useState, type ReactElement } from 'react';
import { useVault } from '../contexts/vault-context.js';

type Step = 1 | 2 | 3;

export function VaultSetup(): ReactElement {
  const vault = useVault();
  const [step, setStep] = useState<Step>(1);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLocalError(null);
    setStep(2);
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setStep(3);
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await vault.create(password, serverUrl, apiKey);
    setLoading(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      await vault.upload(file);
    } catch {
      setUploadError('Failed to upload vault. Please try again.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <h1>Setup Vault</h1>

      <div>
        <label htmlFor="vault-upload-setup">Upload an existing vault</label>
        <input ref={fileInputRef} id="vault-upload-setup" type="file" onChange={handleFileChange} />
        {uploadError && <p role="alert">{uploadError}</p>}
      </div>
      <hr />

      {step === 1 && (
        <form onSubmit={handleStep1}>
          <h2>Step 1: Choose master password</h2>
          <div>
            <label htmlFor="setup-password">Master password</label>
            <input
              id="setup-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="setup-confirm">Confirm password</label>
            <input
              id="setup-confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </div>
          {localError && <p role="alert">{localError}</p>}
          <button type="submit">Next</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2}>
          <h2>Step 2: Server connection</h2>
          <div>
            <label htmlFor="setup-server-url">Server URL</label>
            <input
              id="setup-server-url"
              type="url"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="setup-api-key">API key</label>
            <input
              id="setup-api-key"
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
          </div>
          {localError && <p role="alert">{localError}</p>}
          <button type="button" onClick={() => setStep(1)}>
            Back
          </button>
          <button type="submit">Next</button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleStep3}>
          <h2>Step 3: Confirm</h2>
          <p>Server URL: {serverUrl || '(none)'}</p>
          <p>API key: {apiKey ? '••••••••' : '(none)'}</p>
          {vault.error && <p role="alert">{vault.error}</p>}
          <button type="button" onClick={() => setStep(2)}>
            Back
          </button>
          <button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create Vault'}
          </button>
        </form>
      )}
    </div>
  );
}
