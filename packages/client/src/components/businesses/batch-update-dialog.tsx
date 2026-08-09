import { useContext, useState, type ReactElement } from 'react';
import type { BatchUpdateBusinessInput } from '../../gql/graphql.js';
import { useBatchUpdateBusinesses } from '../../hooks/use-batch-update-businesses.js';
import { useAllCountries } from '../../hooks/use-get-countries.js';
import { useGetTaxCategories } from '../../hooks/use-get-tax-categories.js';
import { cn } from '../../lib/utils.js';
import { UserContext } from '../../providers/user-provider.js';
import { ComboBox, SortCodeSelect } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';

interface BatchUpdateBusinessesDialogProps {
  businessIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful apply, so the caller can refresh the table. */
  onDone: () => void;
}

// tri-state for boolean flags: `unset` leaves the flag untouched across the batch.
type TriState = 'unset' | 'true' | 'false';

// boolean flag keys shared 1:1 with `BatchUpdateBusinessInput`.
type FlagKey =
  'isActive' | 'isReceiptEnough' | 'isDocumentsOptional' | 'optionalVAT' | 'exemptDealer';

type FormState = {
  country: string;
  city: string;
  zipCode: string;
  sortCode: string;
  irsCode: string;
  taxCategory: string;
  suggestionDescription: string;
} & Record<FlagKey, TriState>;

const EMPTY_FORM: FormState = {
  country: '',
  city: '',
  zipCode: '',
  sortCode: '',
  irsCode: '',
  taxCategory: '',
  suggestionDescription: '',
  isActive: 'unset',
  isReceiptEnough: 'unset',
  isDocumentsOptional: 'unset',
  optionalVAT: 'unset',
  exemptDealer: 'unset',
};

// Free-text fields. Country, sort code and tax category are rendered separately as pickers.
// `fullWidth` fields span both columns on wider screens.
const FIELDS: {
  key: keyof FormState;
  label: string;
  numeric?: boolean;
  fullWidth?: boolean;
}[] = [
  { key: 'city', label: 'City' },
  { key: 'zipCode', label: 'Zip code' },
  { key: 'irsCode', label: 'IRS code', numeric: true },
  { key: 'suggestionDescription', label: 'Suggestion description', fullWidth: true },
];

// boolean flags rendered as tri-state selects.
const FLAG_FIELDS: { key: FlagKey; label: string }[] = [
  { key: 'isActive', label: 'Is active' },
  { key: 'isReceiptEnough', label: 'Is receipt enough' },
  { key: 'isDocumentsOptional', label: 'No docs required' },
  { key: 'optionalVAT', label: 'Is VAT optional' },
  { key: 'exemptDealer', label: 'Exempt dealer' },
];

/** Whole non-negative integers only (no decimals or scientific notation). */
const INTEGER_PATTERN = /^\d+$/;

/** Build the mutation input from only the fields the user filled in. */
function buildFields(form: FormState): BatchUpdateBusinessInput {
  const fields: BatchUpdateBusinessInput = {};
  if (form.country.trim()) {
    fields.country = form.country.trim();
  }
  if (form.city.trim()) {
    fields.city = form.city.trim();
  }
  if (form.zipCode.trim()) {
    fields.zipCode = form.zipCode.trim();
  }
  if (form.sortCode.trim()) {
    fields.sortCode = Number(form.sortCode);
  }
  if (form.irsCode.trim()) {
    fields.irsCode = Number(form.irsCode);
  }
  if (form.taxCategory.trim()) {
    fields.taxCategory = form.taxCategory.trim();
  }
  if (form.suggestionDescription.trim()) {
    fields.suggestionDescription = form.suggestionDescription.trim();
  }

  for (const { key } of FLAG_FIELDS) {
    if (form[key] !== 'unset') {
      fields[key] = form[key] === 'true';
    }
  }

  return fields;
}

/**
 * Batch-edit the shared fields of the selected businesses: locality (country/city/zip), sort code,
 * default tax category, IRS code, the suggestion description, and the boolean flags. Only the
 * fields the user actually fills in are sent, so everything else keeps each business's own value.
 * Tags are handled separately by {@link BatchUpdateBusinessesTagsDialog}, which needs add/remove
 * semantics rather than a single shared value.
 */
export function BatchUpdateBusinessesDialog({
  businessIds,
  open,
  onOpenChange,
  onDone,
}: BatchUpdateBusinessesDialogProps): ReactElement {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const { userContext } = useContext(UserContext);
  const { fetching, batchUpdateBusinesses } = useBatchUpdateBusinesses();
  const { countries, fetching: fetchingCountries } = useAllCountries();
  const { selectableTaxCategories, fetching: fetchingTaxCategories } = useGetTaxCategories();

  const fields = buildFields(form);
  const isFormEmpty = Object.keys(fields).length === 0;
  // irsCode maps to GraphQL Int, so only whole non-negative integers are valid — reject decimals
  // and scientific notation that Number() would otherwise coerce. sortCode comes from a picker.
  const hasInvalidNumericFields =
    form.irsCode.trim() !== '' && !INTEGER_PATTERN.test(form.irsCode.trim());

  // Single close path so both the Dialog's own dismissals (overlay/esc/X) and the Cancel button
  // clear the form before closing.
  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setForm(EMPTY_FORM);
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = async (): Promise<void> => {
    if (isFormEmpty || businessIds.length === 0) {
      return;
    }
    const updated = await batchUpdateBusinesses({ businessIds, fields });
    if (updated) {
      setForm(EMPTY_FORM);
      onOpenChange(false);
      onDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-2xl"
        onClick={event => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>
            Batch update {businessIds.length} business{businessIds.length === 1 ? '' : 'es'}
          </DialogTitle>
          <DialogDescription>
            Only the fields you fill in are applied to every selected business.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-1 sm:grid-cols-2">
          <div className="grid gap-1 sm:col-span-2">
            <Label>Country</Label>
            <ComboBox
              data={countries.map(country => ({ value: country.code, label: country.name }))}
              value={form.country || null}
              onChange={value => setForm(prev => ({ ...prev, country: value ?? '' }))}
              disabled={fetchingCountries}
              placeholder="Select country"
            />
          </div>
          <div className="grid gap-1">
            <Label>Sort code</Label>
            <SortCodeSelect
              ownerId={userContext?.context.adminBusinessId}
              value={form.sortCode || null}
              onChange={value =>
                setForm(prev => ({ ...prev, sortCode: value == null ? '' : value.toString() }))
              }
              placeholder="Select sort code"
            />
          </div>
          <div className="grid gap-1">
            <Label>Tax category</Label>
            <ComboBox
              data={selectableTaxCategories}
              value={form.taxCategory || null}
              onChange={value => setForm(prev => ({ ...prev, taxCategory: value ?? '' }))}
              disabled={fetchingTaxCategories}
              placeholder="Select tax category"
            />
          </div>
          {FIELDS.map(field => (
            <div key={field.key} className={cn('grid gap-1', field.fullWidth && 'sm:col-span-2')}>
              <Label htmlFor={`batch-${field.key}`}>{field.label}</Label>
              <Input
                id={`batch-${field.key}`}
                type={field.numeric ? 'number' : 'text'}
                value={form[field.key] as string}
                onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))}
              />
            </div>
          ))}
          {FLAG_FIELDS.map(flag => (
            <div key={flag.key} className="grid gap-1">
              <Label htmlFor={`batch-${flag.key}`}>{flag.label}</Label>
              <Select
                value={form[flag.key]}
                onValueChange={value =>
                  setForm(prev => ({ ...prev, [flag.key]: value as TriState }))
                }
              >
                <SelectTrigger id={`batch-${flag.key}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">No change</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSubmit()}
            disabled={fetching || isFormEmpty || hasInvalidNumericFields}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
