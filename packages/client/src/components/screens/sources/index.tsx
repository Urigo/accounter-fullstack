import { useCallback, useRef, useState, type JSX } from 'react';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Key,
  Loader2,
  Plus,
  PlugZap,
  RefreshCw,
  Trash2,
  Unplug,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'urql';
import { Badge } from '../../ui/badge.js';
import { Button } from '../../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';
import { Separator } from '../../ui/separator.js';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const SOURCE_CONNECTIONS_QUERY = `
  query SourceConnectionsFull {
    sourceConnections {
      id provider displayName accountIdentifier status hasCredentials
      credentialsSummary { key label type required hasValue maskedValue placeholder }
      lastSyncAt lastSyncError updatedAt
    }
  }
`;

const CREATE_SOURCE_MUTATION = `
  mutation CreateSource($input: CreateSourceConnectionInput!) {
    createSourceConnection(input: $input) {
      id provider displayName accountIdentifier status hasCredentials
      credentialsSummary { key label type required hasValue maskedValue placeholder }
      lastSyncAt lastSyncError updatedAt
    }
  }
`;

const SAVE_CREDENTIALS_MUTATION = `
  mutation SaveCreds($id: UUID!, $credentialsJson: String!) {
    saveSourceCredentials(id: $id, credentialsJson: $credentialsJson) {
      id hasCredentials status updatedAt
      credentialsSummary { key label type required hasValue maskedValue placeholder }
    }
  }
`;

const CLEAR_CREDENTIALS_MUTATION = `
  mutation ClearCreds($id: UUID!) {
    clearSourceCredentials(id: $id) {
      id hasCredentials status updatedAt
      credentialsSummary { key label type required hasValue maskedValue placeholder }
    }
  }
`;

const DELETE_SOURCE_MUTATION = `
  mutation DeleteSource($id: UUID!) {
    deleteSourceConnection(id: $id)
  }
`;

const SYNC_PRIORITY_MUTATION = `
  mutation SyncPriorityInvoices($input: SyncPriorityInvoicesInput) {
    syncPriorityInvoices(input: $input) {
      synced skipped errors message
    }
  }
`;

const TEST_PRIORITY_MUTATION = `
  mutation TestPriorityConnection {
    testPriorityConnection { ok message }
  }
`;

const TRIGGER_SOURCE_SYNC_MUTATION = `
  mutation TriggerSourceSync($id: UUID!) {
    triggerSourceSync(id: $id) {
      success message
    }
  }
`;

const IMPORT_PRIORITY_CSV_MUTATION = `
  mutation ImportPriorityCSV($csvContent: String!) {
    importPriorityCSV(csvContent: $csvContent) {
      imported skipped errors suppliersCreated taxCategoriesCreated
    }
  }
`;

// ---------------------------------------------------------------------------
// Provider catalog
// ---------------------------------------------------------------------------

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'id';
  required: boolean;
  placeholder?: string;
}

interface ProviderDef {
  id: string;
  label: string;
  category: 'bank' | 'card' | 'integration';
  fields: FieldDef[];
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'HAPOALIM',
    label: 'Bank Hapoalim',
    category: 'bank',
    fields: [
      { key: 'userCode', label: 'User Code', type: 'text', required: true, placeholder: 'e.g. BG98920' },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'MIZRAHI',
    label: 'Bank Mizrahi',
    category: 'bank',
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'DISCOUNT',
    label: 'Bank Discount',
    category: 'bank',
    fields: [
      { key: 'id', label: 'ID Number', type: 'id', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'code', label: 'Code', type: 'text', required: false },
    ],
  },
  {
    id: 'LEUMI',
    label: 'Bank Leumi',
    category: 'bank',
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'ISRACARD',
    label: 'Isracard',
    category: 'card',
    fields: [
      { key: 'id', label: 'ID Number', type: 'id', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'last6Digits', label: 'Last 6 Digits of Card', type: 'text', required: true, placeholder: 'e.g. 123456' },
    ],
  },
  {
    id: 'AMEX',
    label: 'American Express',
    category: 'card',
    fields: [
      { key: 'id', label: 'ID Number', type: 'id', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'last6Digits', label: 'Last 6 Digits of Card', type: 'text', required: true, placeholder: 'e.g. 123456' },
    ],
  },
  {
    id: 'CAL',
    label: 'CAL',
    category: 'card',
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'last4Digits', label: 'Last 4 Digits', type: 'text', required: false, placeholder: 'e.g. 1234' },
    ],
  },
  {
    id: 'MAX',
    label: 'MAX',
    category: 'card',
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'PRIORITY',
    label: 'Priority',
    category: 'integration',
    fields: [
      {
        key: 'url',
        label: 'OData URL',
        type: 'text',
        required: true,
        placeholder: 'https://p.priority-connect.online/odata/Priority/tabab4f6.ini/a240825/',
      },
      { key: 'username', label: 'Username (email)', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'GREEN_INVOICE',
    label: 'Green Invoice',
    category: 'integration',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'secret', label: 'Secret', type: 'password', required: true },
    ],
  },
];

const PROVIDER_BY_ID: Record<string, ProviderDef> = Object.fromEntries(
  PROVIDERS.map(p => [p.id, p]),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaskedField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  hasValue: boolean;
  maskedValue: string | null;
  placeholder: string | null;
}

interface SourceConnection {
  id: string;
  provider: string;
  displayName: string;
  accountIdentifier: string | null;
  status: string;
  hasCredentials: boolean;
  credentialsSummary: MaskedField[];
  lastSyncAt: string | null;
  lastSyncError: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }): JSX.Element {
  switch (status) {
    case 'ACTIVE':
      return (
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
          <CheckCircle2 size={12} />Connected
        </Badge>
      );
    case 'ERROR':
      return (
        <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 gap-1">
          <AlertCircle size={12} />Error
        </Badge>
      );
    case 'DISCONNECTED':
      return (
        <Badge variant="secondary" className="bg-slate-50 text-slate-600 border-slate-200 gap-1">
          <Unplug size={12} />Disconnected
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
          <Clock size={12} />Pending
        </Badge>
      );
  }
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diffMs / 60_000);
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

// ---------------------------------------------------------------------------
// CredentialForm - used both for Add and Edit
// ---------------------------------------------------------------------------

function CredentialForm({
  fields,
  existing,
  onSave,
  onClear,
  onCancel,
  saving,
  clearing,
}: {
  fields: FieldDef[];
  existing: MaskedField[];
  onSave: (values: Record<string, string>) => Promise<void>;
  onClear?: () => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  clearing: boolean;
}): JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSave = useCallback(async () => {
    const missing = fields
      .filter(f => f.required)
      .filter(f => {
        const existingField = existing.find(e => e.key === f.key);
        return !values[f.key] && !existingField?.hasValue;
      })
      .map(f => f.label);

    if (missing.length > 0) {
      toast.error(`Required: ${missing.join(', ')}`);
      return;
    }

    const payload: Record<string, string> = {};
    for (const f of fields) {
      if (values[f.key]) payload[f.key] = values[f.key];
    }
    if (Object.keys(payload).length === 0) {
      toast.error('Enter at least one field');
      return;
    }
    await onSave(payload);
  }, [fields, existing, values, onSave]);

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Key size={14} />
          Credentials
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X size={14} />
        </Button>
      </div>

      {fields.map(field => {
        const existingField = existing.find(e => e.key === field.key);
        return (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <Input
              type={field.type === 'password' ? 'password' : 'text'}
              placeholder={
                existingField?.hasValue
                  ? `Current: ${existingField.maskedValue}`
                  : field.placeholder ?? `Enter ${field.label.toLowerCase()}`
              }
              value={values[field.key] ?? ''}
              onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="text-sm"
            />
            {existingField?.hasValue && !values[field.key] && (
              <p className="text-xs text-emerald-600">Already configured</p>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        {onClear ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={clearing}
            className="text-red-600 hover:text-red-700"
          >
            {clearing ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
            Clear credentials
          </Button>
        ) : (
          <div />
        )}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Key size={14} />}
          Save securely
        </Button>
      </div>

      <p className="text-xs text-slate-400">
        Credentials are encrypted before saving. They are never shown in plaintext again.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PriorityCSVImport - drag-and-drop / file-picker CSV import widget
// ---------------------------------------------------------------------------

function PriorityCSVImport(): JSX.Element {
  const [{ fetching: importing }, importCSV] = useMutation(IMPORT_PRIORITY_CSV_MUTATION);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
    suppliersCreated: number;
    taxCategoriesCreated: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileToCSV = useCallback(async (file: File): Promise<string> => {
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!isXlsx) return file.text();
    const buffer = await file.arrayBuffer();
    const wb = xlsxRead(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return xlsxUtils.sheet_to_csv(ws, { forceQuotes: true });
  }, []);

  const runImport = useCallback(
    async (file: File) => {
      setResult(null);
      const csvContent = await fileToCSV(file);
      const res = await importCSV({ csvContent });
      if (res.error) {
        toast.error('Import failed: ' + res.error.message);
      } else {
        const r = res.data?.importPriorityCSV;
        setResult(r);
        toast.success(
          `Imported ${r?.imported} invoices, skipped ${r?.skipped}${r?.errors ? `, ${r.errors} errors` : ''}`,
        );
      }
    },
    [importCSV, fileToCSV],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const isSupported =
        file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isSupported) {
        toast.error('Please select a CSV or Excel file');
        return;
      }
      void runImport(file);
    },
    [runImport],
  );

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-slate-600">Import invoices from CSV or Excel export</p>
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          dragging
            ? 'border-blue-400 bg-blue-50'
            : importing
              ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
              : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !importing && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {importing ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 className="animate-spin" size={16} />
            Importing...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
            <Upload size={16} />
            Drop a Priority CSV or Excel file here or click to browse
          </div>
        )}
      </div>

      {result && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
            {result.imported} imported
          </span>
          {result.skipped > 0 && (
            <span className="text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
              {result.skipped} skipped
            </span>
          )}
          {result.errors > 0 && (
            <span className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
              {result.errors} errors
            </span>
          )}
          {result.suppliersCreated > 0 && (
            <span className="text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
              {result.suppliersCreated} new suppliers
            </span>
          )}
          {result.taxCategoriesCreated > 0 && (
            <span className="text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5">
              {result.taxCategoriesCreated} new categories
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceCard - one connected source
// ---------------------------------------------------------------------------

function SourceCard({
  source,
  onRefetch,
}: {
  source: SourceConnection;
  onRefetch: () => void;
}): JSX.Element {
  const [{ fetching: saving }, saveCreds] = useMutation(SAVE_CREDENTIALS_MUTATION);
  const [{ fetching: clearing }, clearCreds] = useMutation(CLEAR_CREDENTIALS_MUTATION);
  const [{ fetching: deleting }, deleteSource] = useMutation(DELETE_SOURCE_MUTATION);
  const [{ fetching: syncing }, syncPriority] = useMutation(SYNC_PRIORITY_MUTATION);
  const [{ fetching: testing }, testPriority] = useMutation(TEST_PRIORITY_MUTATION);
  const [{ fetching: triggering }, triggerSync] = useMutation(TRIGGER_SOURCE_SYNC_MUTATION);
  const [editing, setEditing] = useState(false);

  // Providers that support server-triggered scraping (via triggerSourceSync)
  const SCRAPER_PROVIDERS = ['MIZRAHI', 'ISRACARD', 'PRIORITY'];
  const isScraper = SCRAPER_PROVIDERS.includes(source.provider);
  const isPriority = source.provider === 'PRIORITY';
  // Priority requires credentials in DB; bank scrapers can fall back to .env
  const canSync = isScraper && (source.provider !== 'PRIORITY' || source.hasCredentials);

  const handleTest = useCallback(async () => {
    const res = await testPriority({});
    if (res.error) {
      toast.error('Test failed: ' + res.error.message);
    } else {
      const result = res.data?.testPriorityConnection;
      if (result?.ok) {
        toast.success('Connection OK: ' + result.message);
      } else {
        toast.error('Connection failed: ' + result?.message);
      }
    }
  }, [testPriority]);

  const handleSync = useCallback(async () => {
    if (!isScraper) return;
    toast.info(
      isPriority
        ? 'Starting Priority sync (browser login)... this may take a few minutes.'
        : 'Starting scraper... this may take a few minutes.',
    );
    const res = await triggerSync({ id: source.id });
    if (res.error) {
      toast.error('Sync failed: ' + res.error.message);
    } else {
      const result = res.data?.triggerSourceSync;
      if (result?.success) {
        toast.success(result.message);
      } else {
        toast.error(result?.message ?? 'Sync failed');
      }
      onRefetch();
    }
  }, [isPriority, isScraper, source.id, triggerSync, onRefetch]);

  const providerDef = PROVIDER_BY_ID[source.provider];

  const handleSave = useCallback(
    async (vals: Record<string, string>) => {
      const res = await saveCreds({ id: source.id, credentialsJson: JSON.stringify(vals) });
      if (res.error) {
        toast.error('Failed to save: ' + res.error.message);
      } else {
        toast.success('Credentials saved');
        setEditing(false);
        onRefetch();
      }
    },
    [source.id, saveCreds, onRefetch],
  );

  const handleClear = useCallback(async () => {
    const res = await clearCreds({ id: source.id });
    if (res.error) {
      toast.error('Failed to clear credentials');
    } else {
      toast.success('Credentials cleared');
      setEditing(false);
      onRefetch();
    }
  }, [source.id, clearCreds, onRefetch]);

  const handleDelete = useCallback(async () => {
    const res = await deleteSource({ id: source.id });
    if (res.error) {
      toast.error('Failed to remove source');
    } else {
      toast.success('Source removed');
      onRefetch();
    }
  }, [source.id, deleteSource, onRefetch]);

  return (
    <div className="py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 shrink-0">
            <PlugZap size={16} className="text-slate-500" />
          </div>
          <div>
            <div className="font-medium text-sm">{source.displayName}</div>
            <div className="text-xs text-slate-500">
              {providerDef?.label ?? source.provider}
              {source.accountIdentifier && <span className="ml-1">- {source.accountIdentifier}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right text-xs text-slate-400">
            <div>Last sync: {formatSyncTime(source.lastSyncAt)}</div>
            {source.lastSyncError && (
              <div className="text-red-500 truncate max-w-[160px]">{source.lastSyncError}</div>
            )}
          </div>
          <StatusBadge status={source.status} />
          <Badge
            variant="secondary"
            className={
              source.hasCredentials
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 gap-1'
                : 'bg-amber-50 text-amber-700 border-amber-200 gap-1'
            }
          >
            <Key size={12} />
            {source.hasCredentials ? 'Configured' : 'No credentials'}
          </Badge>
          {isPriority && source.hasCredentials && !editing && (
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="animate-spin" size={14} /> : <PlugZap size={14} />}
              Test
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            <Key size={14} />
            {editing ? 'Cancel' : source.hasCredentials ? 'Edit' : 'Configure'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-500 hover:text-red-600"
          >
            {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={canSync ? handleSync : undefined}
            disabled={!canSync || syncing || triggering}
            title={
              !source.hasCredentials
                ? 'Configure credentials first'
                : isPriority
                  ? 'Sync invoices from Priority'
                  : isScraper
                    ? 'Scrape transactions from bank/card'
                    : 'Sync not supported for this provider'
            }
          >
            {syncing || triggering ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <RefreshCw size={14} />
            )}
          </Button>
        </div>
      </div>

      {/* Masked summary */}
      {source.hasCredentials && !editing && source.credentialsSummary.length > 0 && (
        <div className="flex flex-wrap gap-4 pl-12">
          {source.credentialsSummary
            .filter(f => f.hasValue)
            .map(f => (
              <span key={f.key} className="text-xs text-slate-500">
                {f.label}: <span className="font-mono text-slate-700">{f.maskedValue}</span>
              </span>
            ))}
        </div>
      )}

      {editing && providerDef && (
        <div className="pl-12">
          <CredentialForm
            fields={providerDef.fields}
            existing={source.credentialsSummary}
            onSave={handleSave}
            onClear={source.hasCredentials ? handleClear : undefined}
            onCancel={() => setEditing(false)}
            saving={saving}
            clearing={clearing}
          />
        </div>
      )}

      {isPriority && !editing && (
        <div className="pl-12">
          <PriorityCSVImport />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddSourcePanel - pick provider, enter name + credentials, submit
// ---------------------------------------------------------------------------

function AddSourcePanel({
  onAdded,
  onCancel,
}: {
  onAdded: () => void;
  onCancel: () => void;
}): JSX.Element {
  const [{ fetching }, createSource] = useMutation(CREATE_SOURCE_MUTATION);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [credValues, setCredValues] = useState<Record<string, string>>({});

  const providerDef = PROVIDER_BY_ID[selectedProvider];

  const handleProviderChange = (id: string) => {
    setSelectedProvider(id);
    setCredValues({});
    const def = PROVIDER_BY_ID[id];
    if (def) setDisplayName(def.label);
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedProvider) {
      toast.error('Select a provider');
      return;
    }
    if (!displayName.trim()) {
      toast.error('Enter a display name');
      return;
    }

    const def = PROVIDER_BY_ID[selectedProvider];
    const missing = def?.fields
      .filter(f => f.required && !credValues[f.key])
      .map(f => f.label) ?? [];
    if (missing.length > 0) {
      toast.error(`Required: ${missing.join(', ')}`);
      return;
    }

    const credPayload: Record<string, string> = {};
    for (const f of def?.fields ?? []) {
      if (credValues[f.key]) credPayload[f.key] = credValues[f.key];
    }

    const res = await createSource({
      input: {
        provider: selectedProvider,
        displayName: displayName.trim(),
        accountIdentifier: accountIdentifier.trim() || null,
        credentialsJson: Object.keys(credPayload).length > 0
          ? JSON.stringify(credPayload)
          : null,
      },
    });

    if (res.error) {
      toast.error('Failed to add source: ' + res.error.message);
    } else {
      toast.success(`${displayName} added`);
      onAdded();
    }
  }, [selectedProvider, displayName, accountIdentifier, credValues, createSource, onAdded]);

  const banks = PROVIDERS.filter(p => p.category === 'bank');
  const cards = PROVIDERS.filter(p => p.category === 'card');
  const integrations = PROVIDERS.filter(p => p.category === 'integration');

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Add Source</CardTitle>
            <CardDescription>Connect a bank account, credit card, or integration</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider selection */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-600">Provider *</Label>

          {[{ label: 'Bank Accounts', items: banks }, { label: 'Credit Cards', items: cards }, { label: 'Integrations', items: integrations }].map(group => (
            <div key={group.label}>
              <p className="text-xs text-slate-400 mb-1.5">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      selectedProvider === p.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selectedProvider && (
          <>
            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Display Name *</Label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Main Business Account"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Account Identifier (optional)</Label>
                <Input
                  value={accountIdentifier}
                  onChange={e => setAccountIdentifier(e.target.value)}
                  placeholder="e.g. ****1234"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Key size={12} />
                Login Credentials
              </p>
              {providerDef?.fields.map(field => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  <Input
                    type={field.type === 'password' ? 'password' : 'text'}
                    placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
                    value={credValues[field.key] ?? ''}
                    onChange={e =>
                      setCredValues(prev => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSubmit} disabled={fetching}>
                {fetching ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                Add Source
              </Button>
            </div>

            <p className="text-xs text-slate-400">
              Credentials are encrypted and stored securely. They are never shown in plaintext.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SourcesPage - the main page
// ---------------------------------------------------------------------------

export function SourcesPage(): JSX.Element {
  const [{ data, fetching, error }, refetch] = useQuery({
    query: SOURCE_CONNECTIONS_QUERY,
  });
  const [showAdd, setShowAdd] = useState(false);

  const handleRefetch = useCallback(() => {
    refetch({ requestPolicy: 'network-only' });
  }, [refetch]);

  const handleAdded = useCallback(() => {
    setShowAdd(false);
    handleRefetch();
  }, [handleRefetch]);

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm text-red-600">Failed to load sources: {error.message}</p>
      </div>
    );
  }

  const sources: SourceConnection[] = data?.sourceConnections ?? [];
  const banks = sources.filter(s => PROVIDER_BY_ID[s.provider]?.category === 'bank');
  const cards = sources.filter(s => PROVIDER_BY_ID[s.provider]?.category === 'card');
  const integrations = sources.filter(
    s => PROVIDER_BY_ID[s.provider]?.category === 'integration' || !PROVIDER_BY_ID[s.provider],
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Sources & Credentials</h2>
          <p className="text-sm text-slate-500">
            Connect your bank accounts and credit cards. Credentials are stored encrypted.
          </p>
        </div>
        {!showAdd && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={16} />
            Add Source
          </Button>
        )}
      </div>

      {showAdd && (
        <AddSourcePanel onAdded={handleAdded} onCancel={() => setShowAdd(false)} />
      )}

      {sources.length === 0 && !showAdd ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100">
              <PlugZap size={32} className="text-slate-300" />
            </div>
            <div>
              <p className="font-medium text-slate-700">No sources connected yet</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Add Hapoalim, Mizrahi, Isracard, or any other provider to start importing your transactions automatically.
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} />
              Add your first source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {banks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bank Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                {banks.map((s, i) => (
                  <div key={s.id}>
                    <SourceCard source={s} onRefetch={handleRefetch} />
                    {i < banks.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {cards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Credit Cards</CardTitle>
              </CardHeader>
              <CardContent>
                {cards.map((s, i) => (
                  <div key={s.id}>
                    <SourceCard source={s} onRefetch={handleRefetch} />
                    {i < cards.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {integrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                {integrations.map((s, i) => (
                  <div key={s.id}>
                    <SourceCard source={s} onRefetch={handleRefetch} />
                    {i < integrations.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
