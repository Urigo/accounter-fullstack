'use client';

import { useState, type ReactElement } from 'react';
import { Pencil } from 'lucide-react';
import { useUpdateShaam6111 } from '../../../../hooks/use-update-shaam6111.js';
import { Button } from '../../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../ui/dialog.js';
import { Input } from '../../../ui/input.js';

type Line = { code: number; label: string; amount: number };

/**
 * Edits the year's manual tax-adjustment amounts. A manual amount replaces the computed one, and
 * the totals (370, 400, 500) follow. An empty field goes back to the computed amount.
 */
export function ManualAmountsDialog({
  businessId,
  year,
  lines,
  overrides,
  onSaved,
}: {
  businessId: string;
  year: number;
  /** The lines that take a manual amount */
  lines: Line[];
  overrides: { code: number; amount: number }[];
  onSaved?: () => void;
}): ReactElement {
  const toValues = () =>
    Object.fromEntries(overrides.map(({ code, amount }) => [code, String(amount)]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<number, string>>(toValues);
  const { updateShaam6111, fetching } = useUpdateShaam6111();

  const onOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setValues(toValues());
    }
    setOpen(isOpen);
  };

  const onSave = async () => {
    const taxAdjustmentOverrides = Object.entries(values)
      .filter(([, value]) => value.trim() !== '' && Number.isFinite(Number(value)))
      .map(([code, value]) => ({ code: Number(code), amount: Math.round(Number(value)) }));
    const result = await updateShaam6111({ businessId, year, taxAdjustmentOverrides });
    if (result) {
      setOpen(false);
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          סכומים ידניים
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-screen overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>סכומים ידניים בדוח ההתאמה לשנת {year}</DialogTitle>
          <DialogDescription>
            סכום ידני מחליף את הסכום המחושב, והסיכומים (370, 400, 500) מחושבים מחדש. שדה ריק חוזר
            לסכום המחושב.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {lines.map(line => (
            <div key={line.code} className="grid grid-cols-3 items-center gap-2 text-sm">
              <span className="col-span-2">
                {line.label} ({line.code})
                <span className="text-gray-500"> · מחושב: {line.amount.toLocaleString()}</span>
              </span>
              <Input
                type="number"
                value={values[line.code] ?? ''}
                onChange={event =>
                  setValues(previous => ({ ...previous, [line.code]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onSave} disabled={fetching}>
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
