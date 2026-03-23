import { useCallback, useEffect, useState, type JSX } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  Loader2,
  PlugZap,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'urql';
import { useWorkspace } from '../../../providers/workspace-provider.js';
import { ROUTES } from '../../../router/routes.js';
import { Button } from '../../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';
import { Progress } from '../../ui/progress.js';

type OnboardingStep = 'welcome' | 'identity' | 'sources' | 'review' | 'done';

const STEP_ORDER: OnboardingStep[] = ['welcome', 'identity', 'sources', 'review', 'done'];

const UPDATE_WORKSPACE = `
  mutation OnboardingUpdateWorkspace($input: UpdateWorkspaceSettingsInput!) {
    updateWorkspaceSettings(input: $input) {
      id companyName companyRegistrationNumber logoUrl
    }
  }
`;

const SOURCE_CONNECTIONS_QUERY = `
  query OnboardingSourceConnections {
    sourceConnections {
      id provider displayName status lastSyncAt
    }
  }
`;

const CREATE_SOURCE_MUTATION = `
  mutation OnboardingCreateSource($input: CreateSourceConnectionInput!) {
    createSourceConnection(input: $input) {
      id provider displayName status
    }
  }
`;

const PROVIDER_OPTIONS: { value: string; label: string; category: string }[] = [
  { value: 'HAPOALIM', label: 'Bank Hapoalim', category: 'bank' },
  { value: 'MIZRAHI', label: 'Bank Mizrahi', category: 'bank' },
  { value: 'DISCOUNT', label: 'Bank Discount', category: 'bank' },
  { value: 'LEUMI', label: 'Bank Leumi', category: 'bank' },
  { value: 'ISRACARD', label: 'Isracard', category: 'card' },
  { value: 'AMEX', label: 'American Express', category: 'card' },
  { value: 'CAL', label: 'CAL', category: 'card' },
  { value: 'MAX', label: 'MAX', category: 'card' },
];

function StepIndicator({ current }: { current: OnboardingStep }): JSX.Element {
  const displaySteps = STEP_ORDER.filter(s => s !== 'done');
  const currentIdx = displaySteps.indexOf(current === 'done' ? 'review' : current);

  return (
    <div className="flex items-center gap-2 mb-8">
      {displaySteps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              i < currentIdx
                ? 'bg-emerald-500 text-white'
                : i === currentIdx
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {i < currentIdx ? <Check size={14} /> : i + 1}
          </div>
          {i < displaySteps.length - 1 && (
            <div
              className={`w-12 h-0.5 ${i < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }): JSX.Element {
  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100">
            <Sparkles size={32} className="text-slate-600" />
          </div>
        </div>
        <CardTitle className="text-2xl">Welcome to Accounter</CardTitle>
        <CardDescription className="text-base mt-2">
          Let's set up your finance workspace in a few quick steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3 text-sm text-slate-600 mb-6">
          <div className="flex items-start gap-3">
            <Building2 size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <span>Name your workspace and add your company branding</span>
          </div>
          <div className="flex items-start gap-3">
            <CreditCard size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <span>Review your connected financial sources</span>
          </div>
          <div className="flex items-start gap-3">
            <PlugZap size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <span>Start managing your finances in one place</span>
          </div>
        </div>
        <Button onClick={onNext} className="w-full">
          Get Started
          <ArrowRight size={16} />
        </Button>
      </CardContent>
    </Card>
  );
}

function IdentityStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const { workspace, refetch } = useWorkspace();
  const [{ fetching }, updateSettings] = useMutation(UPDATE_WORKSPACE);
  const [companyName, setCompanyName] = useState(workspace?.companyName || '');
  const [registrationNumber, setRegistrationNumber] = useState(
    workspace?.companyRegistrationNumber || '',
  );
  const [logoUrl, setLogoUrl] = useState(workspace?.logoUrl || '');

  useEffect(() => {
    if (workspace) {
      setCompanyName(workspace.companyName || '');
      setRegistrationNumber(workspace.companyRegistrationNumber || '');
      setLogoUrl(workspace.logoUrl || '');
    }
  }, [workspace]);

  const handleSave = useCallback(async () => {
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    const result = await updateSettings({
      input: {
        companyName: companyName.trim(),
        companyRegistrationNumber: registrationNumber.trim() || null,
        logoUrl: logoUrl.trim() || null,
      },
    });
    if (result.error) {
      toast.error('Failed to save: ' + result.error.message);
    } else {
      refetch();
      onNext();
    }
  }, [companyName, registrationNumber, logoUrl, updateSettings, refetch, onNext]);

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Company Identity</CardTitle>
        <CardDescription>How your company appears in the workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="onb-company">Company Name *</Label>
            <Input
              id="onb-company"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Wright Ltd."
              aria-required="true"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-reg">Company Registration Number (ח.פ)</Label>
            <Input
              id="onb-reg"
              value={registrationNumber}
              onChange={e => setRegistrationNumber(e.target.value)}
              placeholder="e.g. 514123456"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-logo">Logo URL (optional)</Label>
            <Input
              id="onb-logo"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              type="url"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg border bg-slate-50">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Preview"
                  className="w-10 h-10 object-contain rounded"
                  onError={e => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Building2 size={20} className="text-slate-400" />
              )}
            </div>
            <span className="text-sm text-slate-500">
              {logoUrl ? 'Logo preview' : 'Default icon will be used'}
            </span>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={handleSave} disabled={fetching || !companyName.trim()}>
              {fetching && <Loader2 className="animate-spin" size={16} />}
              Continue
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SourceItem {
  id: string;
  provider: string;
  displayName: string;
  status: string;
  lastSyncAt: string | null;
}

function SourcesStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const [{ data, fetching }, refetchSources] = useQuery({ query: SOURCE_CONNECTIONS_QUERY });
  const [, createSource] = useMutation(CREATE_SOURCE_MUTATION);
  const sources: SourceItem[] = data?.sourceConnections ?? [];

  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleProviderChange = useCallback((value: string) => {
    setProvider(value);
    const opt = PROVIDER_OPTIONS.find(p => p.value === value);
    if (opt) setDisplayName(opt.label);
  }, []);

  const handleAddSource = useCallback(async () => {
    if (!provider || !displayName.trim()) {
      toast.error('Select a provider and enter a display name');
      return;
    }
    setAdding(true);
    const result = await createSource({
      input: { provider, displayName: displayName.trim() },
    });
    setAdding(false);
    if (result.error) {
      toast.error('Failed to add source: ' + result.error.message);
    } else {
      toast.success(`${displayName} added — configure credentials in Settings`);
      setShowForm(false);
      setProvider('');
      setDisplayName('');
      refetchSources({ requestPolicy: 'network-only' });
    }
  }, [provider, displayName, createSource, refetchSources]);

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Financial Sources</CardTitle>
        <CardDescription>
          Add at least one source so your database has data. You can skip and configure in
          Settings later, but transactions won't import until sources are added.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        ) : (
          <div className="space-y-4">
            {sources.length === 0 && !showForm && (
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <PlugZap size={28} className="text-slate-300" />
                <p className="text-sm text-slate-500">No sources connected yet.</p>
                <p className="text-xs text-slate-400">
                  Without sources the dashboard will be empty.
                </p>
              </div>
            )}

            {sources.length > 0 && (
              <div className="space-y-2">
                {sources.map(source => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <PlugZap size={16} className="text-slate-500" />
                      <div>
                        <div className="text-sm font-medium">{source.displayName}</div>
                        <div className="text-xs text-slate-500">{source.provider}</div>
                      </div>
                    </div>
                    <div
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        source.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : source.status === 'ERROR'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {source.status === 'ACTIVE'
                        ? 'Connected'
                        : source.status === 'ERROR'
                          ? 'Error'
                          : 'Pending'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showForm ? (
              <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <p className="text-sm font-medium text-slate-700">Add a source</p>
                <div className="space-y-1">
                  <Label htmlFor="onb-provider" className="text-xs">
                    Provider
                  </Label>
                  <select
                    id="onb-provider"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={provider}
                    onChange={e => handleProviderChange(e.target.value)}
                  >
                    <option value="">Select provider...</option>
                    <optgroup label="Banks">
                      {PROVIDER_OPTIONS.filter(p => p.category === 'bank').map(p => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Credit Cards">
                      {PROVIDER_OPTIONS.filter(p => p.category === 'card').map(p => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="onb-srcname" className="text-xs">
                    Display Name
                  </Label>
                  <Input
                    id="onb-srcname"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="e.g. My Business Account"
                    className="text-sm"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Credentials are configured in Settings after onboarding.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowForm(false);
                      setProvider('');
                      setDisplayName('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddSource}
                    disabled={adding || !provider || !displayName.trim()}
                  >
                    {adding && <Loader2 className="animate-spin" size={14} />}
                    Add Source
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowForm(true)}
              >
                <PlugZap size={14} />
                Add a source
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-between pt-6">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <div className="flex gap-2">
            {sources.length === 0 && (
              <Button variant="ghost" onClick={onNext} className="text-slate-500">
                Skip for now
              </Button>
            )}
            <Button onClick={onNext} disabled={fetching}>
              Continue
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  onFinish,
  onBack,
}: {
  onFinish: () => void;
  onBack: () => void;
}): JSX.Element {
  const { workspace } = useWorkspace();
  const [{ data }] = useQuery({ query: SOURCE_CONNECTIONS_QUERY });
  const sources: SourceItem[] = data?.sourceConnections ?? [];
  const activeSources = sources.filter(s => s.status === 'ACTIVE');

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50">
            <Check size={32} className="text-emerald-600" />
          </div>
        </div>
        <CardTitle className="text-2xl">You're all set</CardTitle>
        <CardDescription className="text-base mt-2">
          Your workspace is ready to use.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-slate-600">Company</span>
            <span className="text-sm font-medium">
              {workspace?.companyName || 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-slate-600">ח.פ</span>
            <span className="text-sm font-medium">
              {workspace?.companyRegistrationNumber || 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-slate-600">Logo</span>
            <span className="text-sm font-medium">
              {workspace?.logoUrl ? 'Set' : 'Using default'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-slate-600">Sources</span>
            <span className="text-sm font-medium">
              {sources.length > 0 ? `${sources.length} added` : 'None yet'}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 text-center mb-4">
          You can adjust all of these in Settings at any time.
        </p>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onFinish}>
            Go to Dashboard
            <ArrowRight size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const ONBOARDING_COMPLETE_KEY = 'accounter:onboarding_complete';

export function useOnboardingComplete(): {
  isComplete: boolean;
  markComplete: () => void;
} {
  const [isComplete, setIsComplete] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const markComplete = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, '1');
    } catch {
      // storage unavailable
    }
    setIsComplete(true);
  }, []);

  return { isComplete, markComplete };
}

export function OnboardingWizard(): JSX.Element {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const navigate = useNavigate();
  const { markComplete } = useOnboardingComplete();

  const stepIdx = STEP_ORDER.indexOf(step);
  const progress = Math.round(((stepIdx + 1) / STEP_ORDER.length) * 100);

  const goTo = (s: OnboardingStep) => setStep(s);

  const handleFinish = () => {
    markComplete();
    navigate(ROUTES.HOME, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <StepIndicator current={step} />
          <div className="mb-4">
            <Progress value={progress} className="h-1" />
          </div>
        </div>

        {step === 'welcome' && <WelcomeStep onNext={() => goTo('identity')} />}
        {step === 'identity' && (
          <IdentityStep
            onNext={() => goTo('sources')}
            onBack={() => goTo('welcome')}
          />
        )}
        {step === 'sources' && (
          <SourcesStep
            onNext={() => goTo('review')}
            onBack={() => goTo('identity')}
          />
        )}
        {step === 'review' && (
          <ReviewStep
            onFinish={handleFinish}
            onBack={() => goTo('sources')}
          />
        )}
      </div>
    </div>
  );
}
