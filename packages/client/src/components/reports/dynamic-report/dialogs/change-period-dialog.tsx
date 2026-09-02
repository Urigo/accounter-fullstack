import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { DatePickerInput } from '@/components/common/index.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Label } from '@/components/ui/label.js';
import type { TimelessDateString } from '@/helpers/index.js';

export interface ChangePeriodDialogRef {
  changePeriod: (fromDate: string, toDate: string) => void;
}

type Props = {
  onConfirm: (fromDate: string, toDate: string) => void;
};

/**
 * A draft owns the period it was built for, so the toolbar's date pickers are read-only while one
 * is loaded. Changing the period is deliberate: it re-bases every figure in the report, and the
 * next save records the new period as the draft's own.
 */
export const ChangePeriodDialog = forwardRef<ChangePeriodDialogRef, Props>(
  function ChangePeriodDialog({ onConfirm }: Props, ref) {
    const [open, setOpen] = useState(false);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const changePeriod = useCallback((currentFrom: string, currentTo: string) => {
      setFromDate(currentFrom);
      setToDate(currentTo);
      setOpen(true);
    }, []);

    useImperativeHandle(ref, () => ({ changePeriod }));

    const isValid = !!fromDate && !!toDate && fromDate <= toDate;

    const handleConfirm = (): void => {
      if (!isValid) return;
      onConfirm(fromDate, toDate);
      setOpen(false);
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Draft Period</DialogTitle>
            <DialogDescription>
              Every figure in the report is recalculated for the new period. Save the draft to keep
              it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="change-period-from">From</Label>
              <DatePickerInput
                id="change-period-from"
                value={fromDate as TimelessDateString}
                onChange={value => setFromDate(value ?? '')}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="change-period-to">To</Label>
              <DatePickerInput
                id="change-period-to"
                value={toDate as TimelessDateString}
                onChange={value => setToDate(value ?? '')}
                className="w-40"
              />
            </div>
          </div>
          {fromDate && toDate && fromDate > toDate && (
            <p className="text-sm text-destructive">
              The start date must not be after the end date.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!isValid}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
