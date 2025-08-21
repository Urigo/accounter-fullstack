import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { useQuery } from 'urql';
import { ChargeSortByField, LedgerValidationStatusDocument } from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/index.js';
import { Badge } from '../../../../ui/badge.jsx';
import { CardContent } from '../../../../ui/card.jsx';
import { getAllChargesHref } from '../../../charges/all-charges.jsx';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query LedgerValidationStatus($limit: Int, $filters: ChargeFilter) {
    chargesWithLedgerChanges(limit: $limit, filters: $filters) {
      charge {
        id
      }
    }
  }
`;

interface Step02Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step02LedgerChanges(props: Step02Props) {
  const [status, setStatus] = useState<StepStatus>('blocked');
  const [pendingChanges, setPendingChanges] = useState<number>(Infinity);

  const [{ data, fetching }, fetchStatus] = useQuery({
    query: LedgerValidationStatusDocument,
    variables: {
      filters: {
        byOwners: props.adminBusinessId ? [props.adminBusinessId] : [],
        fromAnyDate: `${props.year}-01-01` as TimelessDateString,
        toAnyDate: `${props.year}-12-31` as TimelessDateString,
      },
    },
    pause: true,
  });

  useEffect(() => {
    if (!data && !fetching && props.adminBusinessId) {
      fetchStatus();
    }
  });

  useEffect(() => {
    if (fetching) setStatus('loading');
  }, [fetching]);

  // Report status changes to parent
  useEffect(() => {
    if (props.onStatusChange) {
      props.onStatusChange(props.id, status);
    }
  }, [status, props.onStatusChange, props.id]);

  useEffect(() => {
    if (data?.chargesWithLedgerChanges) {
      const pendingChanges = data.chargesWithLedgerChanges.filter(
        charge => !!charge.charge?.id,
      ).length;
      setPendingChanges(pendingChanges);

      if (pendingChanges === 0) {
        setStatus('completed');
      } else {
        setStatus('in-progress');
      }
    }
  }, [data]);

  const href = useMemo(() => {
    return getAllChargesHref({
      byOwners: props.adminBusinessId ? [props.adminBusinessId] : undefined,
      fromAnyDate: `${props.year}-01-01` as TimelessDateString,
      toAnyDate: `${props.year}-12-31` as TimelessDateString,
      sortBy: {
        field: ChargeSortByField.Date,
        asc: false,
      },
    });
  }, [props.adminBusinessId, props.year]);

  const actions: StepAction[] = [{ label: 'View Ledger Status', href }];

  return (
    <BaseStepCard
      {...props}
      status={status}
      icon={<Settings className="h-4 w-4" />}
      actions={actions}
    >
      {pendingChanges > 0 && (
        <CardContent className="pt-0 border-t">
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <div className="flex-1">
              <span className="text-sm text-red-800 font-medium">
                {pendingChanges} pending ledger changes detected
              </span>
              {/* <div className="text-xs text-red-600 mt-1">
                Last updated: {new Date(ledgerStatus.lastUpdate).toLocaleString()}
              </div> */}
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
