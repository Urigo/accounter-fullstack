import { useState, type ReactElement } from 'react';
import type { BatchUpdateBusinessInput } from '../../gql/graphql.js';
import { useBatchUpdateBusinesses } from '../../hooks/use-batch-update-businesses.js';
import { useAllCountries } from '../../hooks/use-get-countries.js';
import { ComboBox } from '../common/index.js';
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

interface BatchUpdateBusinessesDialogProps {
  businessIds: string[];
  onDone: () => void;
}

type FormState = {
  country: string;
  city: string;
  zipCode: string;
  sortCode: string;
  irsCode: string;
  taxCategory: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  country: '',
  city: '',
  zipCode: '',
  sortCode: '',
  irsCode: '',
  taxCategory: '',
  description: '',
};

// `country` is rendered separately as a searchable ComboBox; the rest are simple inputs.
const FIELDS: { key: keyof FormState; label: string; placeholder?: string; numeric?: boolean }[] = [
  { key: 'city', label: 'City' },
  { key: 'zipCode', label: 'Zip code' },
  { key: 'sortCode', label: 'Sort code', numeric: true },
  { key: 'irsCode', label: 'IRS code', numeric: true },
  { key: 'taxCategory', label: 'Tax category (UUID)' },
  { key: 'description', label: 'Suggestion description' },
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
  if (form.description.trim()) {
    fields.suggestions = { description: form.description.trim() };
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

  const isFormEmpty = Object.values(form).every(value => !value.trim());
  // sortCode/irsCode map to GraphQL Int, so only whole non-negative integers are valid — reject
  // decimals and scientific notation that Number() would otherwise coerce.
  const hasInvalidNumericFields =
    (form.sortCode.trim() !== '' && !INTEGER_PATTERN.test(form.sortCode.trim())) ||
    (form.irsCode.trim() !== '' && !INTEGER_PATTERN.test(form.irsCode.trim()));

  const onSubmit = async (): Promise<void> => {
    const fields = buildFields(form);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batch update {businessIds.length} businesses</DialogTitle>
          <DialogDescription>
            Only the fields you fill in are applied to every selected business.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
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
            <div key={field.key} className="grid gap-1">
              <Label htmlFor={`batch-${field.key}`}>{field.label}</Label>
              <Input
                id={`batch-${field.key}`}
                type={field.numeric ? 'number' : 'text'}
                value={form[field.key]}
                placeholder={field.placeholder}
                onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))}
              />
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
