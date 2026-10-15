import { useContext, useEffect, useState, type ReactElement } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useQuery } from 'urql';
import {
  SecuritiesTaxCategoryDialogDocument,
  type InsertTaxCategoryInput,
  type SecuritiesTaxCategoryKey,
  type UpdateTaxCategoryInput,
} from '../../gql/graphql.js';
import { useGetTaxCategories } from '../../hooks/use-get-tax-categories.js';
import { useInsertTaxCategory } from '../../hooks/use-insert-tax-category.js';
import { useRegenerateLedgerRecords } from '../../hooks/use-regenerate-ledger-records.js';
import { useUpdateSecuritiesContext } from '../../hooks/use-update-securities-context.js';
import { UserContext } from '../../providers/index.js';
import { ModifyTaxCategoryFields } from '../common/forms/modify-tax-category-fields.js';
import { ComboBox } from '../common/index.js';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog.js';
import { Form } from '../ui/form.js';
import { Label } from '../ui/label.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SecuritiesTaxCategoryDialog {
    adminContext {
      id
      securitiesContext {
        id
        sortCode {
          id
          key
          name
        }
      }
    }
  }
`;

/** How each securities tax category is named, also as the default name of a new one */
export const SECURITIES_TAX_CATEGORY_LABELS: Record<SecuritiesTaxCategoryKey, string> = {
  FOREIGN_SECURITIES_FEES: 'Foreign securities fees',
  FOREIGN_DIVIDEND_INCOME: 'Foreign dividend income',
  LOCAL_DIVIDEND_INCOME: 'Local dividend income',
  FOREIGN_DIVIDEND_WITHHOLDING_TAX: 'Foreign dividend withholding tax',
  LOCAL_DIVIDEND_WITHHOLDING_TAX: 'Local dividend withholding tax',
  FOREIGN_BOND_INTEREST_INCOME: 'Foreign bond interest income',
  LOCAL_BOND_INTEREST_INCOME: 'Local bond interest income',
  FOREIGN_BOND_WITHHOLDING_TAX: 'Foreign bond withholding tax',
  LOCAL_BOND_WITHHOLDING_TAX: 'Local bond withholding tax',
  FOREIGN_SECURITIES_SALE_GAIN: 'Gain from sale of foreign securities',
  FOREIGN_SECURITIES_SALE_LOSS: 'Loss from sale of foreign securities',
};

type Mode = 'existing' | 'new';

type Props = {
  taxCategoryKey: SecuritiesTaxCategoryKey;
  /** The charge whose ledger asked for the category; its ledger is regenerated once it is set */
  chargeId: string;
  onDone?: () => void;
};

/**
 * Sets one of the tenant's securities tax categories, from a ledger error: pick an existing tax
 * category, or create one under the securities sort code. The choice is stored for every future
 * securities ledger, and the charge's ledger is regenerated with it.
 */
export function SecuritiesTaxCategoryDialog({
  taxCategoryKey,
  chargeId,
  onDone,
}: Props): ReactElement {
  const label = SECURITIES_TAX_CATEGORY_LABELS[taxCategoryKey];
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Set {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onClick={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            The tax category securities ledgers book &quot;{label}&quot; to. It is saved for all
            future securities charges, and this charge&apos;s ledger is regenerated with it.
          </DialogDescription>
        </DialogHeader>
        {/* mounted only while open, so a closed button queries nothing and reopening starts fresh */}
        <SecuritiesTaxCategoryForm
          taxCategoryKey={taxCategoryKey}
          chargeId={chargeId}
          onSaved={() => {
            setOpen(false);
            onDone?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function SecuritiesTaxCategoryForm({
  taxCategoryKey,
  chargeId,
  onSaved,
}: Omit<Props, 'onDone'> & { onSaved: () => void }): ReactElement {
  const label = SECURITIES_TAX_CATEGORY_LABELS[taxCategoryKey];
  const [mode, setMode] = useState<Mode>('existing');
  const [selectedTaxCategoryId, setSelectedTaxCategoryId] = useState<string | null>(null);
  const [rememberSortCode, setRememberSortCode] = useState(true);
  const [fetchingSortCodes, setFetchingSortCodes] = useState(false);
  // kept once created, so retrying after a failed save does not create a second one
  const [createdTaxCategoryId, setCreatedTaxCategoryId] = useState<string | null>(null);

  const { userContext } = useContext(UserContext);
  const { selectableTaxCategories, fetching: fetchingTaxCategories } = useGetTaxCategories();
  const [{ data }] = useQuery({ query: SecuritiesTaxCategoryDialogDocument });
  const storedSortCode = data?.adminContext.securitiesContext.sortCode?.key ?? null;

  const { insertTaxCategory, fetching: inserting } = useInsertTaxCategory();
  const { updateSecuritiesContext, fetching: saving } = useUpdateSecuritiesContext();
  const { regenerateLedgerRecords, fetching: regenerating } = useRegenerateLedgerRecords();
  const busy = inserting || saving || regenerating;

  const formManager = useForm<InsertTaxCategoryInput>({ defaultValues: { name: label } });
  const { handleSubmit, setValue, getFieldState, control } = formManager;
  const sortCode = useWatch({ control, name: 'sortCode' });

  // prefill the stored securities sort code, unless the user already picked one
  useEffect(() => {
    if (storedSortCode != null && !getFieldState('sortCode').isDirty) {
      setValue('sortCode', storedSortCode);
    }
  }, [storedSortCode, getFieldState, setValue]);

  const showRememberSortCode = sortCode != null && Number(sortCode) !== storedSortCode;

  async function assign(taxCategoryId: string, newSortCode?: number) {
    const saved = await updateSecuritiesContext({
      input: {
        taxCategories: [{ key: taxCategoryKey, taxCategoryId }],
        ...(newSortCode == null ? {} : { sortCode: newSortCode }),
      },
    });
    if (!saved) {
      return;
    }
    // stay open on failure, so the user can retry; the hook already reported the error
    const regenerated = await regenerateLedgerRecords([chargeId]);
    if (!regenerated) {
      return;
    }
    onSaved();
  }

  const onCreate = handleSubmit(async fields => {
    const parsedSortCode = fields.sortCode == null ? undefined : Number(fields.sortCode);
    let taxCategoryId = createdTaxCategoryId;
    if (!taxCategoryId) {
      const created = await insertTaxCategory({
        fields: { ...fields, sortCode: parsedSortCode },
      });
      if (!created?.id) {
        return;
      }
      taxCategoryId = created.id;
      setCreatedTaxCategoryId(taxCategoryId);
    }
    await assign(
      taxCategoryId,
      rememberSortCode && showRememberSortCode ? parsedSortCode : undefined,
    );
  });

  return (
    <Tabs value={mode} onValueChange={value => setMode(value as Mode)}>
      <TabsList className="w-full">
        <TabsTrigger value="existing">Choose existing</TabsTrigger>
        <TabsTrigger value="new">Create new</TabsTrigger>
      </TabsList>

      <TabsContent value="existing" className="flex flex-col gap-4 pt-4">
        <ComboBox
          data={selectableTaxCategories}
          value={selectedTaxCategoryId}
          onChange={setSelectedTaxCategoryId}
          placeholder="Choose a tax category"
          disabled={fetchingTaxCategories}
        />
        <DialogFooter>
          <Button
            disabled={!selectedTaxCategoryId || busy}
            onClick={() => selectedTaxCategoryId && assign(selectedTaxCategoryId)}
          >
            Save
          </Button>
        </DialogFooter>
      </TabsContent>

      <TabsContent value="new" className="pt-4">
        <Form {...formManager}>
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <ModifyTaxCategoryFields
              isInsert
              formManager={
                formManager as UseFormReturn<
                  UpdateTaxCategoryInput,
                  unknown,
                  UpdateTaxCategoryInput
                >
              }
              setFetching={setFetchingSortCodes}
              ownerId={userContext?.context.adminBusinessId}
            />
            {showRememberSortCode && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`remember-securities-sort-code-${taxCategoryKey}`}
                  checked={rememberSortCode}
                  onCheckedChange={checked => setRememberSortCode(checked === true)}
                />
                <Label htmlFor={`remember-securities-sort-code-${taxCategoryKey}`}>
                  Use this sort code for future securities tax categories
                </Label>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={busy || fetchingSortCodes}>
                {createdTaxCategoryId ? 'Retry saving' : 'Create and save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </TabsContent>
    </Tabs>
  );
}
