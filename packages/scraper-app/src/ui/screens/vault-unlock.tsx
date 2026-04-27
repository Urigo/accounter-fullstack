import { useState, type ReactElement } from 'react';
import { useVault } from '../contexts/vault-context.js';

export function VaultUnlock(): ReactElement {
  const { unlock } = useVault();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await unlock(password);
      if (result !== 'ok') {
        setError(
          result === 'wrong-password' ? 'Wrong password. Please try again.' : 'Vault not found.',
        );
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
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
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
