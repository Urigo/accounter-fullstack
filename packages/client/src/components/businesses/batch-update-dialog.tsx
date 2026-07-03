import { useState, type ReactElement } from 'react';
import type { BatchUpdateBusinessInput } from '../../gql/graphql.js';
import { useBatchUpdateBusinesses } from '../../hooks/use-batch-update-businesses.js';
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

const FIELDS: { key: keyof FormState; label: string; placeholder?: string; numeric?: boolean }[] = [
  { key: 'country', label: 'Country code', placeholder: 'e.g. ISR' },
  { key: 'city', label: 'City' },
  { key: 'zipCode', label: 'Zip code' },
  { key: 'sortCode', label: 'Sort code', numeric: true },
  { key: 'irsCode', label: 'IRS code', numeric: true },
  { key: 'taxCategory', label: 'Tax category (UUID)' },
  { key: 'description', label: 'Suggestion description' },
];

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
          <Button onClick={() => void onSubmit()} disabled={fetching}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
