import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { AnnualAuditStepStatus } from '../../../../../gql/graphql.js';
import { useSetAnnualAuditStep03Status } from '../../../../../hooks/use-set-annual-audit-step03-status.js';
import { Button } from '../../../../ui/button.js';
import { Label } from '../../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select.js';
import { Textarea } from '../../../../ui/textarea.js';
import { type StepStatus } from '../step-base.js';
import { gqlStatusToStepStatus } from './index.js';

const APPROVABLE_STATUSES: AnnualAuditStepStatus[] = [
  AnnualAuditStepStatus.Pending,
  AnnualAuditStepStatus.InProgress,
  AnnualAuditStepStatus.Completed,
];

export function ApprovalControl({
  ownerId,
  year,
  initialStatus,
  initialNotes,
  onSaved,
}: {
  ownerId: string;
  year: number;
  initialStatus?: AnnualAuditStepStatus;
  initialNotes?: string | null;
  onSaved: (status: StepStatus) => void;
}) {
  const [selectedStatus, setSelectedStatus] = useState<AnnualAuditStepStatus>(
    initialStatus ?? AnnualAuditStepStatus.Pending,
  );
  const [notes, setNotes] = useState(initialNotes ?? '');
  const { fetching, setStep03Status } = useSetAnnualAuditStep03Status();

  useEffect(() => {
    setSelectedStatus(initialStatus ?? AnnualAuditStepStatus.Pending);
  }, [initialStatus]);

  useEffect(() => {
    setNotes(initialNotes ?? '');
  }, [initialNotes]);

  const handleSave = useCallback(async () => {
    const result = await setStep03Status({
      input: { ownerId, year, status: selectedStatus, notes: notes || null },
    });
    if (result) {
      onSaved(gqlStatusToStepStatus(result.status as AnnualAuditStepStatus));
    }
  }, [setStep03Status, ownerId, year, selectedStatus, notes, onSaved]);

  return (
    <Card className="mt-3 pl-4">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="w-4" />
        <CardTitle className="text-lg">3b. Accountant Approval</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={selectedStatus}
            onValueChange={v => setSelectedStatus(v as AnnualAuditStepStatus)}
          >
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVABLE_STATUSES.map(s => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="text-xs"
            placeholder="Add any review notes..."
          />
        </div>
        <Button size="sm" className="w-fit" disabled={fetching} onClick={handleSave}>
          {fetching ? 'Saving...' : 'Save Approval'}
        </Button>
      </CardContent>
    </Card>
  );
}
