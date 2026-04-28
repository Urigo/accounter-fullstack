import { useState, type ReactElement } from 'react';
import { useVault } from '../contexts/vault-context.js';

export function VaultUnlock(): ReactElement {
  const vault = useVault();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await vault.unlock(password);
    setLoading(false);
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
    </div>
  );
}
