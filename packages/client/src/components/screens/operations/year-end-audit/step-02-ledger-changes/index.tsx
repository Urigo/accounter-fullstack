import { useEffect, useState } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { Badge } from '../../../../ui/badge.js';
import { CardContent } from '../../../../ui/card.js';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.js';

interface LedgerStatus {
  pendingChanges: number;
  lastUpdate: string;
  requiresAttention: boolean;
}

interface Step02Props extends BaseStepProps {}

export function Step02LedgerChanges(props: Step02Props) {
  const [status, setStatus] = useState<StepStatus>('loading');
  const [ledgerStatus, setLedgerStatus] = useState<LedgerStatus | null>(null);

  // Report status changes to parent
  useEffect(() => {
    if (props.onStatusChange) {
      props.onStatusChange(props.id, status);
    }
  }, [status, props.onStatusChange, props.id]);

  useEffect(() => {
    const fetchLedgerStatus = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));

        const data: LedgerStatus = {
          pendingChanges: 3,
          lastUpdate: '2024-01-15T10:30:00Z',
          requiresAttention: true,
        };

        setLedgerStatus(data);

        if (data.pendingChanges === 0) {
          setStatus('completed');
        } else if (data.requiresAttention) {
          setStatus('blocked');
        } else {
          setStatus('in-progress');
        }
      } catch (error) {
        setStatus('blocked');
      }
    };

    fetchLedgerStatus();
  }, []);

  const actions: StepAction[] = [
    { label: 'View Ledger Status', href: '/ledger/status' },
    { label: 'Resolve Pending Changes', href: '/ledger/pending' },
  ];

  return (
    <BaseStepCard
      {...props}
      status={status}
      icon={<Settings className="h-4 w-4" />}
      actions={actions}
    >
      {ledgerStatus && ledgerStatus.pendingChanges > 0 && (
        <CardContent className="pt-0 border-t">
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <div className="flex-1">
              <span className="text-sm text-red-800 font-medium">
                {ledgerStatus.pendingChanges} pending ledger changes detected
              </span>
              <div className="text-xs text-red-600 mt-1">
                Last updated: {new Date(ledgerStatus.lastUpdate).toLocaleString()}
              </div>
            </div>
            <Badge variant="destructive" className="text-xs">
              Action Required
            </Badge>
          </div>
        </CardContent>
      )}
    </BaseStepCard>
  );
}
