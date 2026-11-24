import { useContext, useMemo, useState, type ReactElement } from 'react';
import { Save, TrendingDown } from 'lucide-react';
import { useQuery } from 'urql';
import { AccounterSpinner } from '@/components/ui/accounter-spinner.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { Button } from '@/components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.js';
import {
  DepreciationSettingsSectionDocument,
  type AdminContextInput,
  type DepreciationSettingsSectionQuery,
} from '@/gql/graphql.js';
import { useGetTaxCategories } from '@/hooks/use-get-tax-categories.js';
import { useUpdateDepreciationSettings } from '@/hooks/use-update-depreciation-settings.js';
import { cn } from '@/lib/utils.js';
import { UserContext } from '@/providers/index.js';
import { ComboBox } from '../../common/inputs/combo-box.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DepreciationSettingsSection {
    adminContext {
      id
      accumulatedDepreciationTaxCategory {
        id
        name
      }
      rndDepreciationExpensesTaxCategory {
        id
        name
      }
      gnmDepreciationExpensesTaxCategory {
        id
        name
      }
      marketingDepreciationExpensesTaxCategory {
        id
        name
      }
      depreciationDisposalGainTaxCategory {
        id
        name
      }
      depreciationDisposalLossTaxCategory {
        id
        name
      }
      depreciationCorrectionTaxCategory {
        id
        name
      }
    }
  }
`;

type AdminContextData = DepreciationSettingsSectionQuery['adminContext'];

const SETTINGS = [
  {
    input: 'accumulatedDepreciationTaxCategoryId',
    field: 'accumulatedDepreciationTaxCategory',
    label: 'Accumulated depreciation',
    description: 'Also the tax category of the yearly depreciation charge',
  },
  {
    input: 'rndDepreciationExpensesTaxCategoryId',
    field: 'rndDepreciationExpensesTaxCategory',
    label: 'R&D depreciation expenses',
  },
  {
    input: 'gnmDepreciationExpensesTaxCategoryId',
    field: 'gnmDepreciationExpensesTaxCategory',
    label: 'G&A depreciation expenses',
  },
  {
    input: 'marketingDepreciationExpensesTaxCategoryId',
    field: 'marketingDepreciationExpensesTaxCategory',
    label: 'Marketing depreciation expenses',
  },
  {
    input: 'depreciationDisposalGainTaxCategoryId',
    field: 'depreciationDisposalGainTaxCategory',
    label: 'Gain on disposal of fixed assets',
    description: 'Capital gain on a sale. Use sort code 991 (regular tax rate) and IRS code 5210',
  },
  {
    input: 'depreciationDisposalLossTaxCategoryId',
    field: 'depreciationDisposalLossTaxCategory',
    label: 'Loss on disposal of fixed assets',
    description: 'Capital loss on a sale or write-off. IRS code 5310',
  },
  {
    input: 'depreciationCorrectionTaxCategoryId',
    field: 'depreciationCorrectionTaxCategory',
    label: 'Depreciation correction (ordinary income)',
    description:
      'Depreciation reversed by a supplier cost refund (a cost correction, not a sale). Confirm its sort code and IRS code with your CPA',
  },
] as const satisfies ReadonlyArray<{
  input: keyof AdminContextInput;
  field: keyof AdminContextData;
  label: string;
  description?: string;
}>;

type SettingInput = (typeof SETTINGS)[number]['input'];

type Props = {
  /** The admin business whose page this is */
  adminBusinessId: string;
};

/**
 * The tenant's depreciation tax categories, including the gain and loss on disposal of fixed
 * assets and the depreciation correction booked for cost refunds. Shown only on the admin page of the single business in the active scope, and only to the
 * business owner (the only role allowed to update the admin context).
 */
export function DepreciationSettingsSection({ adminBusinessId }: Props): ReactElement | null {
  const { userContext } = useContext(UserContext);
  const activeReadScope = userContext?.context.activeReadScope ?? [];
  const role = userContext?.context.memberships.find(
    membership => membership.businessId === adminBusinessId,
  )?.role;

  if (
    activeReadScope.length !== 1 ||
    activeReadScope[0] !== adminBusinessId ||
    role !== 'business_owner'
  ) {
    return null;
  }

  return <DepreciationSettingsCard adminBusinessId={adminBusinessId} />;
}

function DepreciationSettingsCard({ adminBusinessId }: Props): ReactElement {
  const [{ data, fetching, error }, refetch] = useQuery({
    query: DepreciationSettingsSectionDocument,
  });
  const context = data?.adminContext;
  const [edits, setEdits] = useState<Partial<Record<SettingInput, string>>>({});
  const { selectableTaxCategories, fetching: fetchingTaxCategories } = useGetTaxCategories();
  const { updateDepreciationSettings, fetching: saving } = useUpdateDepreciationSettings();

  const options = useMemo(() => {
    const all = [...selectableTaxCategories];
    for (const setting of SETTINGS) {
      const current = context?.[setting.field];
      if (current && !all.some(option => option.value === current.id)) {
        all.push({ value: current.id, label: current.name });
      }
    }
    return all;
  }, [selectableTaxCategories, context]);

  const changed = Object.keys(edits).length > 0;

  const onSave = async () => {
    const result = await updateDepreciationSettings({
      context: { ownerId: adminBusinessId, ...edits },
    });
    if (result) {
      setEdits({});
      refetch({ requestPolicy: 'network-only' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-5" />
          Depreciation
        </CardTitle>
        <CardDescription>
          Tax categories used by the yearly depreciation charge, by asset disposals (sales and
          write-offs) and by supplier cost refunds.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {fetching && <AccounterSpinner className="size-12 self-center" />}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Failed to load depreciation settings</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {context &&
          SETTINGS.map(setting => {
            const value = edits[setting.input] ?? context[setting.field]?.id ?? null;
            return (
              <div
                key={setting.input}
                className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{setting.label}</span>
                  {'description' in setting && (
                    <span className="text-xs text-muted-foreground">{setting.description}</span>
                  )}
                </div>
                <div
                  className={cn(
                    'rounded-md',
                    edits[setting.input] !== undefined && 'border-1 border-green-500',
                  )}
                >
                  <ComboBox
                    data={options}
                    value={value}
                    onChange={next => {
                      setEdits(current => {
                        const updated = { ...current };
                        if (!next || next === context[setting.field]?.id) {
                          delete updated[setting.input];
                        } else {
                          updated[setting.input] = next;
                        }
                        return updated;
                      });
                    }}
                    placeholder="Not set"
                    disabled={saving || fetchingTaxCategories}
                  />
                </div>
              </div>
            );
          })}
      </CardContent>
      {context && (
        <CardFooter className="flex justify-end gap-2 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            disabled={saving || !changed}
            onClick={() => setEdits({})}
          >
            Discard
          </Button>
          <Button type="button" disabled={saving || !changed} onClick={onSave}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
