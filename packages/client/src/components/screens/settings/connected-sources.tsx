import { useCallback, useState, type JSX } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Key,
  Loader2,
  Lock,
  PlugZap,
  RefreshCw,
  Trash2,
  Unplug,
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

const SOURCE_CONNECTIONS_QUERY = `
  query SourceConnections {
    sourceConnections {
      id
      provider
      displayName
      accountIdentifier
      status
      hasCredentials
      credentialsSummary {
        key
        label
        type
        required
        hasValue
        maskedValue
        placeholder
      }
      lastSyncAt
      lastSyncError
      updatedAt
    }
  }
`;

const SAVE_CREDENTIALS_MUTATION = `
  mutation SaveSourceCredentials($id: UUID!, $credentialsJson: String!) {
    saveSourceCredentials(id: $id, credentialsJson: $credentialsJson) {
      id hasCredentials status updatedAt
      credentialsSummary { key label type required hasValue maskedValue placeholder }
    }
  }
`;

const CLEAR_CREDENTIALS_MUTATION = `
  mutation ClearSourceCredentials($id: UUID!) {
    clearSourceCredentials(id: $id) {
      id hasCredentials status updatedAt
      credentialsSummary { key label type required hasValue maskedValue placeholder }
    }
  }
`;

const PROVIDER_LABELS: Record<string, { label: string; category: string }> = {
  HAPOALIM: { label: 'Bank Hapoalim', category: 'bank' },
  MIZRAHI: { label: 'Bank Mizrahi', category: 'bank' },
  DISCOUNT: { label: 'Bank Discount', category: 'bank' },
  LEUMI: { label: 'Bank Leumi', category: 'bank' },
  ISRACARD: { label: 'Isracard', category: 'card' },
  AMEX: { label: 'American Express', category: 'card' },
  CAL: { label: 'CAL', category: 'card' },
  MAX: { label: 'MAX', category: 'card' },
  CLOUDINARY: { label: 'Cloudinary', category: 'integration' },
  GREEN_INVOICE: { label: 'Green Invoice', category: 'integration' },
  GOOGLE_DRIVE: { label: 'Google Drive', category: 'integration' },
  GMAIL: { label: 'Gmail', category: 'integration' },
  DEEL: { label: 'Deel', category: 'integration' },
};

function StatusBadge({ status }: { status: string }): JSX.Element {
  switch (status) {
    case 'ACTIVE':
      return (
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 size={12} />
          Connected
        </Badge>
      );
    case 'ERROR':
      return (
        <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
          <AlertCircle size={12} />
          Error
        </Badge>
      );
    case 'DISCONNECTED':
      return (
        <Badge variant="secondary" className="bg-slate-50 text-slate-600 border-slate-200">
          <Unplug size={12} />
          Disconnected
        </Badge>
      );
    case 'PENDING':
    default:
      return (
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
          <Clock size={12} />
          Pending
        </Badge>
      );
  }
}

function formatSyncTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

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

function CredentialEditor({
  source,
  onClose,
  onSaved,
}: {
  source: SourceConnection;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [{ fetching: saving }, saveCreds] = useMutation(SAVE_CREDENTIALS_MUTATION);
  const [{ fetching: clearing }, clearCreds] = useMutation(CLEAR_CREDENTIALS_MUTATION);
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSave = useCallback(async () => {
    const missingRequired = source.credentialsSummary
      .filter(f => f.required && !f.hasValue && !values[f.key])
      .map(f => f.label);

    if (missingRequired.length > 0) {
      toast.error(`Required: ${missingRequired.join(', ')}`);
      return;
    }

    const payload: Record<string, string> = {};
    for (const field of source.credentialsSummary) {
      if (values[field.key]) {
        payload[field.key] = values[field.key];
      }
    }

    if (Object.keys(payload).length === 0) {
      toast.error('Enter at least one credential field');
      return;
    }

    const result = await saveCreds({
      id: source.id,
      credentialsJson: JSON.stringify(payload),
    });

    if (result.error) {
      toast.error('Failed to save credentials');
    } else {
      toast.success('Credentials saved securely');
      onSaved();
      onClose();
    }
  }, [source, values, saveCreds, onSaved, onClose]);

  const handleClear = useCallback(async () => {
    const result = await clearCreds({ id: source.id });
    if (result.error) {
      toast.error('Failed to clear credentials');
    } else {
      toast.success('Credentials cleared');
      onSaved();
      onClose();
    }
  }, [source.id, clearCreds, onSaved, onClose]);

  return (
    <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-slate-500" />
          <span className="text-sm font-medium">Credentials</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      <div className="space-y-3">
        {source.credentialsSummary.map(field => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`cred-${source.id}-${field.key}`} className="text-xs">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <div className="relative">
              <Input
                id={`cred-${source.id}-${field.key}`}
                type={field.type === 'password' ? 'password' : 'text'}
                placeholder={
                  field.hasValue
                    ? `Current: ${field.maskedValue}`
                    : field.placeholder || `Enter ${field.label.toLowerCase()}`
                }
                value={values[field.key] || ''}
                onChange={e =>
                  setValues(prev => ({ ...prev, [field.key]: e.target.value }))
                }
                className="text-sm"
              />
              {field.hasValue && !values[field.key] && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600">
                  Configured
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        {source.hasCredentials ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={clearing}
            className="text-red-600 hover:text-red-700"
          >
            {clearing ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
            Clear All
          </Button>
        ) : (
          <div />
        )}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Lock size={14} />}
          Save Securely
        </Button>
      </div>

      <p className="text-xs text-slate-400">
        Credentials are encrypted at rest and never displayed after saving.
      </p>
    </div>
  );
}

function SourceRow({
  source,
  onRefetch,
}: {
  source: SourceConnection;
  onRefetch: () => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const providerInfo = PROVIDER_LABELS[source.provider] || {
    label: source.provider,
    category: 'other',
  };

  return (
    <div className="py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
            <PlugZap size={18} className="text-slate-600" />
          </div>
          <div>
            <div className="font-medium text-sm">{source.displayName}</div>
            <div className="text-xs text-slate-500">
              {providerInfo.label}
              {source.accountIdentifier && (
                <span className="ml-1">- {source.accountIdentifier}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-slate-500">
            <div>Last sync: {formatSyncTime(source.lastSyncAt)}</div>
            {source.lastSyncError && (
              <div className="text-red-500 truncate max-w-[200px]">{source.lastSyncError}</div>
            )}
          </div>
          <StatusBadge status={source.status} />
          <Badge
            variant="secondary"
            className={
              source.hasCredentials
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }
          >
            <Key size={12} />
            {source.hasCredentials ? 'Configured' : 'Not configured'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            <Key size={14} />
            {source.hasCredentials ? 'Edit' : 'Configure'}
          </Button>
          <Button variant="outline" size="sm" disabled>
            <RefreshCw size={14} />
            Sync
          </Button>
        </div>
      </div>

      {source.hasCredentials && !editing && source.credentialsSummary.length > 0 && (
        <div className="flex flex-wrap gap-3 pl-14">
          {source.credentialsSummary
            .filter(f => f.hasValue)
            .map(field => (
              <span key={field.key} className="text-xs text-slate-500">
                {field.label}: <span className="font-mono">{field.maskedValue}</span>
              </span>
            ))}
        </div>
      )}

      {editing && (
        <div className="pl-14">
          <CredentialEditor
            source={source}
            onClose={() => setEditing(false)}
            onSaved={onRefetch}
          />
        </div>
      )}
    </div>
  );
}

export function ConnectedSources(): JSX.Element {
  const [{ data, fetching, error }, refetch] = useQuery({
    query: SOURCE_CONNECTIONS_QUERY,
  });

  const handleRefetch = useCallback(() => {
    refetch({ requestPolicy: 'network-only' });
  }, [refetch]);

  if (fetching) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-sm text-red-600">Failed to load source connections</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sources: SourceConnection[] = data?.sourceConnections || [];
  const banks = sources.filter(s => PROVIDER_LABELS[s.provider]?.category === 'bank');
  const cards = sources.filter(s => PROVIDER_LABELS[s.provider]?.category === 'card');
  const integrations = sources.filter(
    s =>
      PROVIDER_LABELS[s.provider]?.category === 'integration' ||
      !PROVIDER_LABELS[s.provider],
  );

  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connected Sources</CardTitle>
          <CardDescription>
            Bank accounts, credit cards, and integrations linked to this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
              <PlugZap size={28} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">No sources connected</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Connect a bank account or credit card to start importing transactions.
                Sources are configured during workspace setup.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {banks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {banks.map((source, i) => (
              <div key={source.id}>
                <SourceRow source={source} onRefetch={handleRefetch} />
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
            {cards.map((source, i) => (
              <div key={source.id}>
                <SourceRow source={source} onRefetch={handleRefetch} />
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
            {integrations.map((source, i) => (
              <div key={source.id}>
                <SourceRow source={source} onRefetch={handleRefetch} />
                {i < integrations.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
