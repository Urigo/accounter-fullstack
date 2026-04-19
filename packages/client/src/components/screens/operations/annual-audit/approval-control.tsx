import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { useSetAnnualAuditStepStatus } from '@/hooks/use-set-annual-audit-step-status.js';
import { AnnualAuditStepStatus } from '../../../../gql/graphql.js';
import { Button } from '../../../ui/button.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { Textarea } from '../../../ui/textarea.js';
import { type StepStatus } from './step-base.js';

export function gqlStatusToStepStatus(status: AnnualAuditStepStatus): StepStatus {
  switch (status) {
    case AnnualAuditStepStatus.Completed:
      return 'completed';
    case AnnualAuditStepStatus.InProgress:
      return 'in-progress';
    case AnnualAuditStepStatus.Blocked:
      return 'blocked';
    default:
      return 'pending';
  }
}

const APPROVABLE_STATUSES: AnnualAuditStepStatus[] = [
  AnnualAuditStepStatus.Pending,
  AnnualAuditStepStatus.InProgress,
  AnnualAuditStepStatus.Completed,
];

export function ApprovalControl({
  ownerId,
  stepId,
  year,
  initialStatus,
  initialNotes,
  onSaved,
}: {
  ownerId: string;
  stepId: string;
  year: number;
  initialStatus?: AnnualAuditStepStatus;
  initialNotes?: string | null;
  onSaved: (status: StepStatus) => void;
}) {
  const [selectedStatus, setSelectedStatus] = useState<AnnualAuditStepStatus>(
    initialStatus ?? AnnualAuditStepStatus.Pending,
  );
  const [notes, setNotes] = useState(initialNotes ?? '');
  const { fetching, setStepStatus } = useSetAnnualAuditStepStatus();

  useEffect(() => {
    setSelectedStatus(initialStatus ?? AnnualAuditStepStatus.Pending);
  }, [initialStatus]);

  useEffect(() => {
    setNotes(initialNotes ?? '');
  }, [initialNotes]);

  const handleSave = useCallback(async () => {
    const result = await setStepStatus({
      input: { ownerId, year, status: selectedStatus, notes: notes || null, stepId },
    });
    if (result) {
      onSaved(gqlStatusToStepStatus(result.status));
    }
  }, [setStepStatus, ownerId, year, selectedStatus, notes, stepId, onSaved]);

  return (
    <Card className="mt-3 pl-4">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="w-4" />
        <CardTitle className="text-lg">Accountant Approval</CardTitle>
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
