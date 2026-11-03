import { useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { CandlestickChart, Info, Save, X } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator.js';
import {
  SecuritiesSettingsSectionDocument,
  type SecuritiesContextInput,
  type SecuritiesSettingsSectionQuery,
  type SecuritiesTaxCategoryKey,
} from '@/gql/graphql.js';
import { useGetBusinesses } from '@/hooks/use-get-businesses.js';
import { useGetTaxCategories } from '@/hooks/use-get-tax-categories.js';
import { useUpdateSecuritiesContext } from '@/hooks/use-update-securities-context.js';
import { cn } from '@/lib/utils.js';
import { UserContext } from '@/providers/index.js';
import {
  SECURITIES_TAX_CATEGORY_LABELS,
  SecuritiesTaxCategoryDialog,
} from '../../charges/securities-tax-category-dialog.js';
import { ComboBox } from '../../common/inputs/combo-box.js';
import { SortCodeSelect } from '../../common/inputs/sort-code-select.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SecuritiesSettingsSection {
    adminContext {
      id
      securitiesContext {
        id
        foreignSecuritiesBusiness {
          id
          name
        }
        sortCode {
          id
          key
          name
        }
        taxCategories {
          id
          key
          taxCategory {
            id
            name
          }
        }
      }
    }
  }
`;

/** The roles `updateSecuritiesContext` (and the `adminContext` query) admits */
const EDITOR_ROLES = new Set(['business_owner', 'accountant']);

const TAX_CATEGORY_KEYS = Object.keys(SECURITIES_TAX_CATEGORY_LABELS) as SecuritiesTaxCategoryKey[];

type SecuritiesContext = SecuritiesSettingsSectionQuery['adminContext']['securitiesContext'];

type Option = { value: string; label: string };

/** The stored settings, as the ids and keys the pickers hold */
type Settings = {
  businessId: string | null;
  sortCode: number | null;
  taxCategories: Partial<Record<SecuritiesTaxCategoryKey, string | null>>;
};

/** What the user changed and has not saved yet; an absent field is untouched, `null` clears it */
type Edits = {
  businessId?: string | null;
  sortCode?: number | null;
  taxCategories: Partial<Record<SecuritiesTaxCategoryKey, string | null>>;
};

const NO_EDITS: Edits = { taxCategories: {} };

function toSettings(context?: SecuritiesContext): Settings {
  return {
    businessId: context?.foreignSecuritiesBusiness?.id ?? null,
    sortCode: context?.sortCode?.key ?? null,
    taxCategories: Object.fromEntries(
      context?.taxCategories.map(entry => [entry.key, entry.taxCategory?.id ?? null]) ?? [],
    ),
  };
}

/** The edits that differ from the stored settings, as an `updateSecuritiesContext` input */
function toChangedInput(stored: Settings, edits: Edits): SecuritiesContextInput | null {
  const input: SecuritiesContextInput = {};
  if (edits.businessId !== undefined && edits.businessId !== stored.businessId) {
    input.foreignSecuritiesBusinessId = edits.businessId;
  }
  if (edits.sortCode !== undefined && edits.sortCode !== stored.sortCode) {
    input.sortCode = edits.sortCode;
  }
  const taxCategories = TAX_CATEGORY_KEYS.filter(key => {
    const edit = edits.taxCategories[key];
    return edit !== undefined && edit !== (stored.taxCategories[key] ?? null);
  }).map(key => ({ key, taxCategoryId: edits.taxCategories[key] ?? null }));
  if (taxCategories.length > 0) {
    input.taxCategories = taxCategories;
  }
  return Object.keys(input).length > 0 ? input : null;
}

/** Keeps the current choice visible even before (or without) it showing up among the options */
function withCurrentOption(options: Option[], current?: { id: string; name: string } | null) {
  if (!current || options.some(option => option.value === current.id)) {
    return options;
  }
  return [...options, { value: current.id, label: current.name }];
}

type Props = {
  /** The admin business whose page this is */
  adminBusinessId: string;
};

/**
 * The tenant's securities ledger configuration: the foreign-securities business, the sort code new
 * securities tax categories are created under, and the tax category of every securities key.
 * Shown only on the active tenant's own admin page, and only to the roles allowed to change it.
 */
export function SecuritiesSettingsSection({ adminBusinessId }: Props): ReactElement | null {
  const { userContext } = useContext(UserContext);
  const role = userContext?.context.memberships.find(
    membership => membership.businessId === adminBusinessId,
  )?.role;

  // the configuration read and written is always the active tenant's, never the viewed page's
  if (
    userContext?.context.adminBusinessId !== adminBusinessId ||
    !role ||
    !EDITOR_ROLES.has(role)
  ) {
    return null;
  }

  return <SecuritiesSettingsCard adminBusinessId={adminBusinessId} />;
}

function SecuritiesSettingsCard({ adminBusinessId }: Props): ReactElement {
  const { userContext, setUserContext } = useContext(UserContext);
  const [{ data, fetching, error }, refetch] = useQuery({
    query: SecuritiesSettingsSectionDocument,
  });
  const context = data?.adminContext.securitiesContext;
  const stored = useMemo(() => toSettings(context), [context]);

  const [edits, setEdits] = useState<Edits>(NO_EDITS);

  const {
    selectableTaxCategories,
    fetching: fetchingTaxCategories,
    refresh: refreshTaxCategories,
  } = useGetTaxCategories();
  const { selectableBusinesses, fetching: fetchingBusinesses } = useGetBusinesses();
  const { updateSecuritiesContext, fetching: saving } = useUpdateSecuritiesContext();

  const businessId = edits.businessId === undefined ? stored.businessId : edits.businessId;
  const sortCode = edits.sortCode === undefined ? stored.sortCode : edits.sortCode;
  const taxCategoryId = (key: SecuritiesTaxCategoryKey) =>
    edits.taxCategories[key] === undefined
      ? (stored.taxCategories[key] ?? null)
      : edits.taxCategories[key];

  const changedInput = toChangedInput(stored, edits);
  const isChanged = (field: keyof SecuritiesContextInput, key?: SecuritiesTaxCategoryKey) =>
    field === 'taxCategories'
      ? !!changedInput?.taxCategories?.some(entry => entry.key === key)
      : changedInput?.[field] !== undefined;

  const businessOptions = useMemo(
    () => withCurrentOption(selectableBusinesses, context?.foreignSecuritiesBusiness),
    [selectableBusinesses, context],
  );
  const taxCategoryOptions = useMemo(
    () =>
      context?.taxCategories.reduce(
        (options, entry) => withCurrentOption(options, entry.taxCategory),
        selectableTaxCategories,
      ) ?? selectableTaxCategories,
    [selectableTaxCategories, context],
  );

  const reload = () => refetch({ requestPolicy: 'network-only' });

  async function onSave() {
    if (!changedInput) {
      return;
    }
    const saved = await updateSecuritiesContext({ input: changedInput });
    if (!saved) {
      // keep the edits, so the user can fix what the server rejected and retry
      return;
    }
    setEdits(NO_EDITS);
    if (changedInput.foreignSecuritiesBusinessId !== undefined && userContext) {
      // the transactions counterparty cell reads it from the user context
      setUserContext({
        ...userContext,
        context: {
          ...userContext.context,
          foreignSecuritiesBusinessId: saved.foreignSecuritiesBusiness?.id ?? null,
        },
      });
    }
    reload();
  }

  const disabled = fetching || saving;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CandlestickChart className="h-5 w-5 text-primary" />
          <CardTitle>Securities</CardTitle>
        </div>
        <CardDescription>
          Where securities ledgers book fees, dividends, bond interest, withheld tax and sale gains
          and losses
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error loading the securities settings</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {!context && fetching && <AccounterSpinner className="self-center" />}
        {context && (
          <>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Changing a setting does not regenerate existing ledgers. Regenerate the ledgers of
                the affected charges to apply it to them.
              </AlertDescription>
            </Alert>

            <SettingRow
              label="Foreign securities business"
              changed={isChanged('foreignSecuritiesBusinessId')}
              onClear={
                businessId
                  ? () => setEdits(current => ({ ...current, businessId: null }))
                  : undefined
              }
              disabled={disabled}
            >
              <ComboBox
                data={businessOptions}
                value={businessId}
                onChange={value => setEdits(current => ({ ...current, businessId: value }))}
                placeholder="Choose a business"
                disabled={disabled || fetchingBusinesses}
              />
            </SettingRow>

            <SettingRow
              label="Securities sort code"
              description="New securities tax categories are created under it"
              changed={isChanged('sortCode')}
              onClear={
                sortCode == null
                  ? undefined
                  : () => setEdits(current => ({ ...current, sortCode: null }))
              }
              disabled={disabled}
            >
              <SortCodeSelect
                ownerId={adminBusinessId}
                value={sortCode}
                onChange={value => setEdits(current => ({ ...current, sortCode: value }))}
                placeholder="Choose a sort code"
                disabled={disabled}
              />
            </SettingRow>

            <Separator />

            {TAX_CATEGORY_KEYS.map(key => {
              const value = taxCategoryId(key);
              const setValue = (id: string | null) =>
                setEdits(current => ({
                  ...current,
                  taxCategories: { ...current.taxCategories, [key]: id },
                }));
              return (
                <SettingRow
                  key={key}
                  label={SECURITIES_TAX_CATEGORY_LABELS[key]}
                  changed={isChanged('taxCategories', key)}
                  onClear={value ? () => setValue(null) : undefined}
                  disabled={disabled}
                  action={
                    <SecuritiesTaxCategoryDialog
                      taxCategoryKey={key}
                      triggerLabel="Create"
                      defaultMode="new"
                      onDone={() => {
                        // the dialog saved this key itself; keep the other unsaved edits
                        setEdits(current => {
                          const { [key]: _saved, ...rest } = current.taxCategories;
                          return { ...current, taxCategories: rest };
                        });
                        refreshTaxCategories();
                        reload();
                      }}
                    />
                  }
                >
                  <ComboBox
                    data={taxCategoryOptions}
                    value={value}
                    onChange={setValue}
                    placeholder="Not set"
                    disabled={disabled || fetchingTaxCategories}
                  />
                </SettingRow>
              );
            })}
          </>
        )}
      </CardContent>
      {context && (
        <CardFooter className="flex justify-end gap-2 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            disabled={saving || !changedInput}
            onClick={() => setEdits(NO_EDITS)}
          >
            Discard
          </Button>
          <Button type="button" disabled={disabled || !changedInput} onClick={onSave}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function SettingRow({
  label,
  description,
  changed,
  onClear,
  disabled,
  action,
  children,
}: {
  label: string;
  description?: string;
  changed: boolean;
  /** Omitted when there is nothing to clear */
  onClear?: () => void;
  disabled: boolean;
  action?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      data-testid="securities-setting"
      className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className={cn('flex-1 rounded-md', changed && 'border-1 border-green-500')}>
          {children}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Clear ${label}`}
          disabled={disabled || !onClear}
          onClick={onClear}
        >
          <X className="size-4" />
        </Button>
        {action}
      </div>
    </div>
  );
}
