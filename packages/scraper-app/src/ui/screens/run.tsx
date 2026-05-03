import { ChangeEvent, useEffect, useState, type ReactElement } from 'react';
import { Settings } from '../../server/vault.js';
import { OtpModal } from '../components/otp-modal.js';
import { SkeletonRow } from '../components/skeleton.js';
import { TaskRow } from '../components/task-row.js';
import { getSources, loadSettings, saveSettings } from '../lib/api.js';
import type { UseRunSocketResult } from '../lib/ws.js';
import type { SourceConfig } from './config/source-types.js';
import { SOURCE_LABELS } from './config/source-types.js';

function nickname(src: SourceConfig): string {
  if (src.nickname) return src.nickname;
  return `${SOURCE_LABELS[src.type]} (${src.id.slice(0, 6)})`;
}

type RunProps = UseRunSocketResult & { onNavigateAccounts?: () => void; isVisible?: boolean };

export function Run({
  send,
  taskStates,
  runStatus,
  summary,
  onNavigateAccounts,
  isVisible = true,
}: RunProps): ReactElement {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [months, setMonths] = useState(3);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shouldFetchRates, setShouldFetchRates] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(s => setShouldFetchRates(s.fetchBankOfIsraelRates))
      .catch(() => setError('Failed to load settings'));
  }, []);

  useEffect(() => {
    if (!isVisible || selected.size > 0) return;
    setSourcesLoading(true);
    getSources<SourceConfig>()
      .then(srcs => {
        setSources(srcs);
        setSelected(new Set(srcs.map(s => s.id)));
      })
      .finally(() => setSourcesLoading(false));
  }, [isVisible]);

  function toggleSource(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function autoSave(patch: Partial<Settings>) {
    try {
      const updated = await saveSettings(patch);
      setShouldFetchRates(updated.fetchBankOfIsraelRates);
    } catch {
      setError('Failed to toggle currency rates setting');
    }
  }

  const handleToggleRates = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setShouldFetchRates(value);
    void autoSave({ fetchBankOfIsraelRates: value });
  };

  function handleRun() {
    const sourceIds = [...selected];
    const msg = {
      type: 'run-start' as const,
      sourceIds,
      dateFrom: useCustomRange
        ? dateFrom || undefined
        : new Date(new Date().getFullYear(), new Date().getMonth() - months, new Date().getDate())
            .toISOString()
            .split('T')[0],
      dateTo: useCustomRange ? dateTo || undefined : undefined,
    };
    send(msg);
  }

  // Find any task waiting for OTP
  const otpEntry = [...taskStates.entries()].find(([, s]) => s.status === 'otp-required');

  return (
    <div>
      <h2 style={{ margin: '0 0 16px' }}>Run Scrapers</h2>

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {/* Source checklist */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1em' }}>Sources</h3>
        {sourcesLoading ? (
          <div aria-busy="true">
            <SkeletonRow width="55%" />
            <SkeletonRow width="70%" />
            <SkeletonRow width="45%" />
          </div>
        ) : sources.length === 0 ? (
          <p style={{ color: '#888' }}>No sources configured.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sources.map(src => (
              <label
                key={src.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(src.id)}
                  onChange={() => toggleSource(src.id)}
                />
                {nickname(src)}
              </label>
            ))}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={shouldFetchRates} onChange={handleToggleRates} />
              Currency Rates (Bank of Israel)
            </label>
          </div>
        )}
      </section>

      {/* Date range */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1em' }}>Date Range</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={useCustomRange}
            onChange={e => setUseCustomRange(e.target.checked)}
          />
          Use custom date range
        </label>
        {useCustomRange ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              From
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                aria-label="date from"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              To
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                aria-label="date to"
              />
            </label>
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Last{' '}
            <input
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={e => setMonths(Number(e.target.value))}
              style={{ width: 60, padding: '4px 6px' }}
              aria-label="months"
            />{' '}
            months
          </label>
        )}
      </section>

      {/* Run button */}
      <button
        type="button"
        onClick={handleRun}
        disabled={runStatus === 'running' || selected.size === 0}
        style={{
          padding: '8px 24px',
          background: runStatus === 'running' ? '#9ca3af' : '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: runStatus === 'running' || selected.size === 0 ? 'default' : 'pointer',
          fontSize: '1em',
          marginBottom: 24,
        }}
      >
        {runStatus === 'running' ? 'Running…' : 'Run'}
      </button>

      {/* Task list */}
      {taskStates.size > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1em' }}>Tasks</h3>
          {[...taskStates.entries()].map(([sourceId, state]) => {
            const src = sources.find(s => s.id === sourceId);
            return (
              <TaskRow
                key={sourceId}
                sourceId={sourceId}
                nickname={src ? nickname(src) : sourceId}
                state={state}
                onNavigateAccounts={onNavigateAccounts}
              />
            );
          })}
        </section>
      )}

      {/* Summary panel */}
      {runStatus === 'complete' && summary && (
        <section
          aria-label="Run summary"
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '1em' }}>Run Complete</h3>
          <div style={{ display: 'flex', gap: 24 }}>
            <span>↑ {summary.totalInserted} new</span>
            <span>↷ {summary.totalSkipped} skipped</span>
            {summary.errors > 0 && (
              <span style={{ color: '#b91c1c' }}>✕ {summary.errors} errors</span>
            )}
          </div>
        </section>
      )}

      {/* OTP modal */}
      {otpEntry && (
        <OtpModal
          sourceId={otpEntry[0]}
          onSubmit={msg => {
            send(msg);
          }}
        />
      )}
    </div>
  );
}
