import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import type { Settings } from '../../../server/vault.js';
import { loadSettings, saveSettings } from '../../lib/api.js';

export function SettingsTab(): ReactElement {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings()
      .then(s => setSettings(s))
      .catch(() => setError('Failed to load settings'));
  }, []);

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
    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
    if (value !== undefined && Number.isNaN(value)) return;
    setSettings(s => (s ? { ...s, defaultDateRangeMonths: value } : s));
    void autoSave({ defaultDateRangeMonths: value });
  }

  function handleTextBlur(key: 'historyFilePath') {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value || undefined;
      setSettings(s => (s ? { ...s, [key]: value } : s));
      void autoSave({ [key]: value });
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
    </div>
  );
}
