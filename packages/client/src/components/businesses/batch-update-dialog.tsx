import { useState, type ReactElement } from 'react';
import type { BatchUpdateBusinessInput } from '../../gql/graphql.js';
import { useBatchUpdateBusinesses } from '../../hooks/use-batch-update-businesses.js';
import { useAllCountries } from '../../hooks/use-get-countries.js';
import { useGetTags } from '../../hooks/use-get-tags.js';
import { cn } from '../../lib/utils.js';
import { ComboBox, MultiSelect } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';

interface BatchUpdateBusinessesDialogProps {
  businessIds: string[];
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
  description: string;
  tags: string[];
} & Record<FlagKey, TriState>;

const EMPTY_FORM: FormState = {
  country: '',
  city: '',
  zipCode: '',
  sortCode: '',
  irsCode: '',
  taxCategory: '',
  description: '',
  tags: [],
  isActive: 'unset',
  isReceiptEnough: 'unset',
  isDocumentsOptional: 'unset',
  optionalVAT: 'unset',
  exemptDealer: 'unset',
};

// `country` is rendered separately as a searchable ComboBox; the rest are simple inputs.
// `fullWidth` fields span both columns on wider screens.
const FIELDS: {
  key: keyof FormState;
  label: string;
  placeholder?: string;
  numeric?: boolean;
  fullWidth?: boolean;
}[] = [
  { key: 'city', label: 'City' },
  { key: 'zipCode', label: 'Zip code' },
  { key: 'sortCode', label: 'Sort code', numeric: true },
  { key: 'irsCode', label: 'IRS code', numeric: true },
  { key: 'taxCategory', label: 'Tax category (UUID)', fullWidth: true },
  { key: 'description', label: 'Suggestion description', fullWidth: true },
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

  const suggestions: NonNullable<BatchUpdateBusinessInput['suggestions']> = {};
  if (form.description.trim()) {
    suggestions.description = form.description.trim();
  }
  if (form.tags.length > 0) {
    suggestions.tags = form.tags.map(id => ({ id }));
  }
  if (Object.keys(suggestions).length > 0) {
    fields.suggestions = suggestions;
  }

  for (const { key } of FLAG_FIELDS) {
    if (form[key] !== 'unset') {
      fields[key] = form[key] === 'true';
    }
  }

  return fields;
}

export function BatchUpdateBusinessesDialog({
  businessIds,
  onDone,
}: BatchUpdateBusinessesDialogProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const { fetching, batchUpdateBusinesses } = useBatchUpdateBusinesses();
  const { countries, fetching: fetchingCountries } = useAllCountries();
  const { selectableTags, fetching: fetchingTags } = useGetTags();

  const fields = buildFields(form);
  const isFormEmpty = Object.keys(fields).length === 0;
  // sortCode/irsCode map to GraphQL Int, so only whole non-negative integers are valid — reject
  // decimals and scientific notation that Number() would otherwise coerce.
  const hasInvalidNumericFields =
    (form.sortCode.trim() !== '' && !INTEGER_PATTERN.test(form.sortCode.trim())) ||
    (form.irsCode.trim() !== '' && !INTEGER_PATTERN.test(form.irsCode.trim()));

  const onSubmit = async (): Promise<void> => {
    if (Object.keys(fields).length === 0) {
      return;
    }
    const updated = await batchUpdateBusinesses({ businessIds, fields });
    if (updated) {
      setForm(EMPTY_FORM);
      setOpen(false);
      onDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={businessIds.length === 0}>
          Batch update{businessIds.length ? ` (${businessIds.length})` : ''}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch update {businessIds.length} businesses</DialogTitle>
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
          {FIELDS.map(field => (
            <div key={field.key} className={cn('grid gap-1', field.fullWidth && 'sm:col-span-2')}>
              <Label htmlFor={`batch-${field.key}`}>{field.label}</Label>
              <Input
                id={`batch-${field.key}`}
                type={field.numeric ? 'number' : 'text'}
                value={form[field.key] as string}
                placeholder={field.placeholder}
                onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))}
              />
            </div>
          ))}
          <div className="grid gap-1 sm:col-span-2">
            <Label>Tags</Label>
            <MultiSelect
              options={selectableTags}
              onValueChange={value => setForm(prev => ({ ...prev, tags: value }))}
              defaultValue={form.tags}
              placeholder="Select tags"
              variant="default"
              disabled={fetchingTags}
            />
          </div>
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
          <Button variant="outline" onClick={() => setOpen(false)}>
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
