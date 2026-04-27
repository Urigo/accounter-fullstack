import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';

type Settings = {
  showBrowser: boolean;
  fetchBankOfIsraelRates: boolean;
  concurrentScraping: boolean;
  serverUrl?: string;
  apiKey?: string;
};

async function loadSettings(): Promise<Settings> {
  const res = await fetch('/api/vault/settings');
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json() as Promise<Settings>;
}

async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const res = await fetch('/api/vault/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json() as Promise<Settings>;
}

export function SettingsTab(): ReactElement {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(s => setSettings(s))
      .catch(() => setError('Failed to load settings'));
  }, []);

  function setField<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(s => (s ? { ...s, [key]: value } : s));
    setDirty(true);
  }

  function handleToggle(key: 'showBrowser' | 'fetchBankOfIsraelRates' | 'concurrentScraping') {
    return (e: ChangeEvent<HTMLInputElement>) => setField(key, e.target.checked);
  }

  function handleText(key: 'serverUrl' | 'apiKey') {
    return (e: ChangeEvent<HTMLInputElement>) => setField(key, e.target.value || undefined);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await saveSettings(settings);
      setSettings(updated);
      setDirty(false);
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p>{error ?? 'Loading…'}</p>;

  return (
    <div>
      <h2>Settings</h2>

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 'bold', marginBottom: 12 }}>Scraper options</legend>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            id="showBrowser"
            type="checkbox"
            checked={settings.showBrowser}
            onChange={handleToggle('showBrowser')}
          />
          Show browser during scraping
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            id="fetchBankOfIsraelRates"
            type="checkbox"
            checked={settings.fetchBankOfIsraelRates}
            onChange={handleToggle('fetchBankOfIsraelRates')}
          />
          Fetch Bank of Israel exchange rates
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            id="concurrentScraping"
            type="checkbox"
            checked={settings.concurrentScraping}
            onChange={handleToggle('concurrentScraping')}
          />
          Scrape sources concurrently
        </label>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, margin: '16px 0 0' }}>
        <legend style={{ fontWeight: 'bold', marginBottom: 12 }}>Server connection</legend>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="serverUrl" style={{ display: 'block', marginBottom: 4 }}>
            Server URL
          </label>
          <input
            id="serverUrl"
            type="text"
            value={settings.serverUrl ?? ''}
            onChange={handleText('serverUrl')}
            style={{ width: '100%', maxWidth: 400, padding: '4px 8px' }}
            placeholder="https://your-accounter-server"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="apiKey" style={{ display: 'block', marginBottom: 4 }}>
            API Key
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              id="apiKey"
              type={showApiKey ? 'text' : 'password'}
              value={settings.apiKey ?? ''}
              onChange={handleText('apiKey')}
              style={{ flex: 1, maxWidth: 400, padding: '4px 8px' }}
              placeholder="your-api-key"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(s => !s)}
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </fieldset>

      <div style={{ marginTop: 20 }}>
        <button onClick={() => void handleSave()} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
