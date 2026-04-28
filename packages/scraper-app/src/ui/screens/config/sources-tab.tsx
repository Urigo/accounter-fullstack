import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createSource, deleteSource, getSources, updateSource } from '../../lib/api.js';
import { SourceForm } from './source-forms.js';
import { SOURCE_LABELS, type SourceConfig, type SourceType } from './source-types.js';

type DialogState =
  | { mode: 'add'; sourceType: SourceType }
  | { mode: 'edit'; source: SourceConfig }
  | { mode: 'confirm-delete'; source: SourceConfig }
  | null;

export function SourcesTab(): ReactElement {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [addType, setAddType] = useState<SourceType>('poalim');

  const load = useCallback(async () => {
    try {
      const list = await getSources<SourceConfig>();
      setSources(list);
    } catch {
      setError('Failed to load sources');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(data: Omit<SourceConfig, 'id' | 'type'>) {
    try {
      const list = await createSource<SourceConfig>({
        ...data,
        type: (dialog as { mode: 'add'; sourceType: SourceType }).sourceType,
      });
      setSources(list);
      setDialog(null);
    } catch {
      setError('Failed to add source');
    }
  }

  async function handleEdit(data: Omit<SourceConfig, 'id' | 'type'>) {
    const source = (dialog as { mode: 'edit'; source: SourceConfig }).source;
    try {
      const list = await updateSource<SourceConfig>(source.id, data);
      setSources(list);
      setDialog(null);
    } catch {
      setError('Failed to update source');
    }
  }

  async function handleDelete(id: string) {
    try {
      const list = await deleteSource<SourceConfig>(id);
      setSources(list);
      setDialog(null);
    } catch {
      setError('Failed to delete source');
    }
  }

  function displayName(s: SourceConfig): string {
    if (s.nickname) return s.nickname;
    if (s.type === 'poalim') return `Poalim (${s.userCode})`;
    if (s.type === 'discount') return `Discount (${s.ID})`;
    if (s.type === 'isracard' || s.type === 'amex')
      return `${SOURCE_LABELS[s.type]} (${s.ownerId})`;
    if (s.type === 'cal' || s.type === 'max') return `${SOURCE_LABELS[s.type]} (${s.username})`;
    return '';
  }

  return (
    <div>
      <h2>Bank Sources</h2>

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {sources.length === 0 && !dialog && <p>No sources configured yet.</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {sources.map(s => (
          <li
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid #eee',
            }}
          >
            <span style={{ flex: 1 }}>
              <strong>{SOURCE_LABELS[s.type]}</strong> — {displayName(s)}
            </span>
            <button onClick={() => setDialog({ mode: 'edit', source: s })}>Edit</button>
            <button onClick={() => setDialog({ mode: 'confirm-delete', source: s })}>Delete</button>
          </li>
        ))}
      </ul>

      {!dialog && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <select
            aria-label="Source type"
            value={addType}
            onChange={e => setAddType(e.target.value as SourceType)}
          >
            {(Object.keys(SOURCE_LABELS) as SourceType[]).map(t => (
              <option key={t} value={t}>
                {SOURCE_LABELS[t]}
              </option>
            ))}
          </select>
          <button onClick={() => setDialog({ mode: 'add', sourceType: addType })}>
            Add Source
          </button>
        </div>
      )}

      {dialog && (
        <div style={{ marginTop: 16, padding: 16, border: '1px solid #ccc', borderRadius: 4 }}>
          {dialog.mode === 'confirm-delete' ? (
            <>
              <h3 style={{ marginTop: 0 }}>Delete source?</h3>
              <p>
                This will permanently remove{' '}
                <strong>
                  {SOURCE_LABELS[dialog.source.type]} — {displayName(dialog.source)}
                </strong>{' '}
                and its stored credentials.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void handleDelete(dialog.source.id)}>Confirm delete</button>
                <button onClick={() => setDialog(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <h3 style={{ marginTop: 0 }}>
                {dialog.mode === 'add'
                  ? `Add ${SOURCE_LABELS[dialog.sourceType]}`
                  : `Edit ${SOURCE_LABELS[dialog.source.type]}`}
              </h3>
              <SourceForm
                sourceType={dialog.mode === 'add' ? dialog.sourceType : dialog.source.type}
                initial={dialog.mode === 'edit' ? dialog.source : undefined}
                onSave={dialog.mode === 'add' ? handleAdd : handleEdit}
                onCancel={() => setDialog(null)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
