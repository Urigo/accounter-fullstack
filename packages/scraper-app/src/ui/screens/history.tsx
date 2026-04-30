import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { RunRecord, SourceRunRecord } from '../../shared/types.js';
import { getHistory } from '../lib/api.js';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatDuration(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

const SOURCE_STATUS_STYLE: Record<string, { background: string; color: string }> = {
  ok: { background: '#dcfce7', color: '#15803d' },
  error: { background: '#fee2e2', color: '#b91c1c' },
};

function SourceRow({ src }: { src: SourceRunRecord }): ReactElement {
  const hasError = !!src.error;
  const style = SOURCE_STATUS_STYLE[hasError ? 'error' : 'ok']!;
  return (
    <tr>
      <td style={{ padding: '4px 8px', color: '#555' }}>{src.sourceId}</td>
      <td style={{ padding: '4px 8px', color: '#555' }}>{src.sourceType}</td>
      <td style={{ padding: '4px 8px' }}>
        <span
          style={{
            ...style,
            padding: '1px 7px',
            borderRadius: 10,
            fontSize: '0.78em',
            fontWeight: 600,
          }}
        >
          {hasError ? 'error' : 'ok'}
        </span>
      </td>
      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{src.inserted}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{src.skipped}</td>
      <td style={{ padding: '4px 8px', color: '#b91c1c' }}>{src.error ?? '—'}</td>
    </tr>
  );
}

function RunRow({ record }: { record: RunRecord }): ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer', background: expanded ? '#f9fafb' : undefined }}
        aria-expanded={expanded}
      >
        <td style={{ padding: '8px 10px' }}>{formatDateTime(record.startedAt)}</td>
        <td style={{ padding: '8px 10px' }}>
          {formatDuration(record.startedAt, record.finishedAt)}
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{record.sources.length}</td>
        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{record.totalInserted}</td>
        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{record.totalSkipped}</td>
        <td
          style={{
            padding: '8px 10px',
            textAlign: 'right',
            color: record.errorCount > 0 ? '#b91c1c' : undefined,
            fontWeight: record.errorCount > 0 ? 600 : undefined,
          }}
        >
          {record.errorCount}
        </td>
        <td style={{ padding: '8px 10px', color: '#888', fontSize: '0.85em' }}>
          {expanded ? '▲' : '▼'}
        </td>
      </tr>

      {expanded && record.sources.length > 0 && (
        <tr>
          <td colSpan={7} style={{ padding: '0 16px 12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88em' }}>
              <thead>
                <tr style={{ color: '#888', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Source</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Type</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>New</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>
                    Skipped
                  </th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {record.sources.map(src => (
                  <SourceRow key={src.sourceId} src={src} />
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}

      {expanded && record.sources.length === 0 && (
        <tr>
          <td colSpan={7} style={{ padding: '4px 16px 12px', color: '#aaa', fontSize: '0.88em' }}>
            No per-source breakdown available.
          </td>
        </tr>
      )}
    </>
  );
}

export function History(): ReactElement {
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getHistory()
      .then(setRecords)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Scrape History</h2>
        <button type="button" onClick={load} style={{ padding: '4px 14px', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : records.length === 0 ? (
        <p style={{ color: '#888' }}>No scrape runs recorded yet.</p>
      ) : (
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.93em' }}
          aria-label="Scrape history"
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#374151', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', fontWeight: 600 }}>Date / Time</th>
              <th style={{ padding: '8px 10px', fontWeight: 600 }}>Duration</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Sources</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>New</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Skipped</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Errors</th>
              <th style={{ padding: '8px 10px' }} />
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <RunRow key={r.id} record={r} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
