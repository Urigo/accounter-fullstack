import { useCallback, useEffect, useState, type JSX } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { useWorkspace } from '../../../providers/workspace-provider.js';
import { Button } from '../../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select.js';

const UPDATE_WORKSPACE = `
  mutation UpdateWorkspaceFinance($input: UpdateWorkspaceSettingsInput!) {
    updateWorkspaceSettings(input: $input) {
      id defaultCurrency agingThresholdDays matchingToleranceAmount
      billingCurrency billingPaymentTermsDays
    }
  }
`;

const CURRENCIES = [
  { value: 'ILS', label: 'ILS - Israeli Shekel' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

interface FinanceFormState {
  defaultCurrency: string;
  agingThresholdDays: string;
  matchingToleranceAmount: string;
  billingCurrency: string;
  billingPaymentTermsDays: string;
}

export function FinancePreferences(): JSX.Element {
  const { workspace, isLoading: wsLoading, refetch } = useWorkspace();
  const [{ fetching }, updateSettings] = useMutation(UPDATE_WORKSPACE);
  const [dirty, setDirty] = useState(false);

  const [form, setForm] = useState<FinanceFormState>({
    defaultCurrency: 'ILS',
    agingThresholdDays: '30',
    matchingToleranceAmount: '0.01',
    billingCurrency: '',
    billingPaymentTermsDays: '30',
  });

  useEffect(() => {
    if (workspace) {
      setForm({
        defaultCurrency: workspace.defaultCurrency || 'ILS',
        agingThresholdDays: String(workspace.agingThresholdDays ?? 30),
        matchingToleranceAmount: String(workspace.matchingToleranceAmount ?? 0.01),
        billingCurrency: workspace.billingCurrency || '',
        billingPaymentTermsDays: String(workspace.billingPaymentTermsDays ?? 30),
      });
      setDirty(false);
    }
  }, [workspace]);

  const update = useCallback(
    (field: keyof FinanceFormState, value: string) => {
      setForm(prev => ({ ...prev, [field]: value }));
      setDirty(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const aging = parseInt(form.agingThresholdDays, 10);
    const tolerance = parseFloat(form.matchingToleranceAmount);
    const terms = parseInt(form.billingPaymentTermsDays, 10);

    if (Number.isNaN(aging) || aging < 1) {
      toast.error('Aging threshold must be at least 1 day');
      return;
    }
    if (Number.isNaN(tolerance) || tolerance < 0) {
      toast.error('Matching tolerance must be 0 or greater');
      return;
    }
    if (Number.isNaN(terms) || terms < 0) {
      toast.error('Payment terms must be 0 or greater');
      return;
    }

    const result = await updateSettings({
      input: {
        defaultCurrency: form.defaultCurrency,
        agingThresholdDays: aging,
        matchingToleranceAmount: tolerance,
        billingCurrency: form.billingCurrency || null,
        billingPaymentTermsDays: terms,
      },
    });
    if (result.error) {
      toast.error('Failed to save: ' + result.error.message);
    } else {
      toast.success('Finance preferences saved');
      setDirty(false);
      refetch();
    }
  }, [form, updateSettings, refetch]);

  if (wsLoading) {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Currency and Accounting</CardTitle>
          <CardDescription>
            Default currency and reconciliation behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Select
                value={form.defaultCurrency}
                onValueChange={v => update('defaultCurrency', v)}
              >
                <SelectTrigger id="defaultCurrency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agingThreshold">Aging Threshold (days)</Label>
              <Input
                id="agingThreshold"
                type="number"
                min="1"
                value={form.agingThresholdDays}
                onChange={e => update('agingThresholdDays', e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Transactions older than this are flagged as aging
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="matchingTolerance">Matching Tolerance</Label>
              <Input
                id="matchingTolerance"
                type="number"
                min="0"
                step="0.01"
                value={form.matchingToleranceAmount}
                onChange={e => update('matchingToleranceAmount', e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Maximum amount difference for automatic matching
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing Defaults</CardTitle>
          <CardDescription>
            Default values for new invoices and billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="billingCurrency">Billing Currency</Label>
              <Select
                value={form.billingCurrency || form.defaultCurrency}
                onValueChange={v => update('billingCurrency', v)}
              >
                <SelectTrigger id="billingCurrency">
                  <SelectValue placeholder="Same as default" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
              <Input
                id="paymentTerms"
                type="number"
                min="0"
                value={form.billingPaymentTermsDays}
                onChange={e => update('billingPaymentTermsDays', e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Default payment due period for new invoices
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={fetching || !dirty}>
          {fetching ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Check size={16} />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
