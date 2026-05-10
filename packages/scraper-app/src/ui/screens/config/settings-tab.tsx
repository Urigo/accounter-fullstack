import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import type { Settings } from '../../../server/vault.js';
import { getVaultPath, loadSettings, saveSettings, vaultDownload } from '../../lib/api.js';

function getBasename(p: string) {
  return p.split('/').pop()?.split('\\').pop() ?? '.vault';
}

export function SettingsTab(): ReactElement {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [vaultPath, setVaultPath] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedVaultPathRef = useRef<string>('');

  useEffect(() => {
    loadSettings()
      .then(s => setSettings(s))
      .catch(() => setError('Failed to load settings'));
    getVaultPath()
      .then(r => {
        setVaultPath(r.path);
        savedVaultPathRef.current = r.path;
      })
      .catch(() => setVaultPath(''));
  }, []);

  function handleCopyPath() {
    void navigator.clipboard.writeText(vaultPath).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function autoSave(patch: Partial<Settings>) {
    try {
      const updated = await saveSettings(patch);
      setSettings(updated);
    } catch {
      setError('Failed to save settings');
    }
  }

  function handleToggle(key: 'showBrowser' | 'fetchBankOfIsraelRates' | 'concurrentScraping') {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.checked;
      setSettings(s => (s ? { ...s, [key]: value } : s));
      void autoSave({ [key]: value });
    };
  }

  function handleNumberBlur(e: ChangeEvent<HTMLInputElement>) {
    const parsed = e.target.value ? parseInt(e.target.value, 10) : undefined;
    if (parsed !== undefined && Number.isNaN(parsed)) return;
    // Fall back to current value when field is cleared; server default takes over on next load
    const value = parsed ?? settings?.defaultDateRangeMonths ?? 3;
    setSettings(s => (s ? { ...s, defaultDateRangeMonths: value } : s));
    void autoSave({ defaultDateRangeMonths: parsed });
  }

  function handleTextBlur(key: 'historyFilePath') {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value || settings?.[key] || './history.json';
      setSettings(s => (s ? { ...s, [key]: value } : s));
      void autoSave({ [key]: e.target.value || undefined });
    };
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

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="defaultDateRangeMonths" style={{ display: 'block', marginBottom: 4 }}>
            Default date range (months)
          </label>
          <input
            id="defaultDateRangeMonths"
            type="number"
            min={1}
            defaultValue={settings.defaultDateRangeMonths ?? ''}
            onBlur={handleNumberBlur}
            style={{ padding: '4px 8px', width: 80 }}
            placeholder="e.g. 6"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="historyFilePath" style={{ display: 'block', marginBottom: 4 }}>
            History file path
          </label>
          <input
            id="historyFilePath"
            type="text"
            defaultValue={settings.historyFilePath ?? ''}
            onBlur={handleTextBlur('historyFilePath')}
            style={{ padding: '4px 8px', width: '100%', maxWidth: 400 }}
            placeholder="/path/to/history.json"
          />
        </div>
      </fieldset>

      {vaultPath && (
        <fieldset style={{ border: 'none', padding: 0, margin: '20px 0 0' }}>
          <legend style={{ fontWeight: 'bold', marginBottom: 12 }}>Vault file</legend>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input
              id="vaultFilePath"
              type="text"
              value={vaultPath}
              onChange={e => setVaultPath(e.target.value)}
              onBlur={async e => {
                const val = e.target.value.trim();
                if (!val || val === savedVaultPathRef.current) return;
                await autoSave({ vaultPath: val });
                savedVaultPathRef.current = val;
                setVaultPath(val);
              }}
              aria-label="Vault file path"
              style={{ padding: '4px 8px', width: '100%', maxWidth: 360 }}
              placeholder=".vault"
            />
            <button
              type="button"
              onClick={handleCopyPath}
              style={{ padding: '4px 12px', whiteSpace: 'nowrap' }}
            >
              {copied ? '✓ Copied' : 'Copy path'}
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await vaultDownload(getBasename(vaultPath || '.vault'));
                } catch {
                  setError('Failed to download vault.');
                } finally {
                  setDownloading(false);
                }
              }}
              style={{ padding: '4px 12px', whiteSpace: 'nowrap' }}
            >
              {downloading ? 'Downloading…' : 'Download'}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85em', color: '#6b7280' }}>
            Back up this file to preserve your credentials.
          </p>
        </fieldset>
      )}
    </div>
  );
}
