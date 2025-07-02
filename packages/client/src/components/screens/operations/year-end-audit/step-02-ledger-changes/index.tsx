import { useContext, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { useQuery } from 'urql';
import { ChargeSortByField, LedgerValidationStatusDocument } from '../../../../../gql/graphql.js';
import { TimelessDateString } from '../../../../../helpers/index.js';
import { UserContext } from '../../../../../providers/user-provider.js';
import { Badge } from '../../../../ui/badge.js';
import { CardContent } from '../../../../ui/card.js';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.js';

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
}

export function Step02LedgerChanges(props: Step02Props) {
  const [status, setStatus] = useState<StepStatus>('blocked');
  const [pendingChanges, setPendingChanges] = useState<number>(Infinity);
  const { userContext } = useContext(UserContext);

  const [{ data, fetching }, fetchStatus] = useQuery({
    query: LedgerValidationStatusDocument,
    variables: {
      filters: {
        byOwners: userContext ? [userContext.context.adminBusinessId] : [],
        fromAnyDate: `${props.year}-01-01` as TimelessDateString,
        toAnyDate: `${props.year}-12-31` as TimelessDateString,
      },
    },
    pause: true,
  });

  useEffect(() => {
    if (!data && !fetching && userContext?.context.adminBusinessId) {
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
    const params = new URLSearchParams();
    const chargesFilters = {
      byOwners: [userContext?.context.adminBusinessId],
      fromAnyDate: `${props.year}-01-01`,
      toAnyDate: `${props.year}-12-31`,
      sortBy: {
        field: ChargeSortByField.Date,
        asc: false,
      },
    };

    function encodeChargesFilters(json: Record<string, unknown>) {
      const jsonString = JSON.stringify(json);
      const encoded = encodeURIComponent(jsonString);
      return encoded;
    }

    // Add it as a single encoded parameter
    params.append('chargesFilters', encodeChargesFilters(chargesFilters));

    return `/charges-ledger-validation?${params}`;
  }, [userContext?.context.adminBusinessId, props.year]);

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
