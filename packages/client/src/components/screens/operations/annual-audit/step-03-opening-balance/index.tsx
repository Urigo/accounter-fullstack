import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calculator, Info } from 'lucide-react';
import { useQuery } from 'urql';
import { ROUTES } from '@/router/routes.js';
import {
  AnnualAuditOpeningBalanceStatusDocument,
  AnnualAuditOpeningBalanceUserType,
  AnnualAuditStepStatus,
} from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert.js';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { ApprovalControl } from '../approval-control.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';
import { MigratingSubsteps } from './migrating-substep.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AnnualAuditOpeningBalanceStatus($ownerId: UUID!, $year: Int!) {
    annualAuditOpeningBalanceStatus(ownerId: $ownerId, year: $year) {
      id
      userType
      balanceChargeId
      derivedStatus
      errorMessage
    }
  }
`;

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

interface Step03Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step03OpeningBalance(props: Step03Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<StepStatus>('pending');

  const { adminBusinessId, id, onStatusChange, year } = props;

  const [{ data, fetching, error }] = useQuery({
    query: AnnualAuditOpeningBalanceStatusDocument,
    variables: { ownerId: adminBusinessId!, year },
    pause: !adminBusinessId,
  });

  const persistedStep03Record = useMemo(() => {
    if (!Array.isArray(props.manualData)) return undefined;
    return props.manualData.find(record => record.stepId === id);
  }, [props.manualData, id]);

  const persistedManualStatus = useMemo<StepStatus | undefined>(() => {
    const persistedStatus = persistedStep03Record?.status;
    if (!persistedStatus) return undefined;
    return gqlStatusToStepStatus(persistedStatus as AnnualAuditStepStatus);
  }, [persistedStep03Record]);

  const persistedManualNotes = persistedStep03Record?.notes ?? null;

  useEffect(() => {
    setApprovalStatus(persistedManualStatus ?? 'pending');
  }, [persistedManualStatus]);

  const derivedStatus = useMemo<StepStatus>(() => {
    if (!adminBusinessId) return 'blocked';
    if (fetching) return 'loading';
    if (error || !data?.annualAuditOpeningBalanceStatus) return 'pending';
    return gqlStatusToStepStatus(data.annualAuditOpeningBalanceStatus.derivedStatus);
  }, [adminBusinessId, fetching, error, data]);

  // Final status: manual approval overrides derived
  const finalStatus = approvalStatus ?? derivedStatus;

  useEffect(() => {
    onStatusChange?.(id, finalStatus);
  }, [finalStatus, onStatusChange, id]);

  const statusInfo = data?.annualAuditOpeningBalanceStatus;

  return (
    <>
      <BaseStepCard
        {...props}
        status={finalStatus}
        icon={<Calculator className="h-4 w-4" />}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      {adminBusinessId && (
        <Collapsible open={isExpanded}>
          <CollapsibleContent className="space-y-2 pt-2">
            {/* ── ERROR ── */}
            {statusInfo?.userType === AnnualAuditOpeningBalanceUserType.Error && (
              <Alert variant="destructive" className="ml-8">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Configuration Error</AlertTitle>
                <AlertDescription>{statusInfo.errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* ── NEW ── */}
            {statusInfo?.userType === AnnualAuditOpeningBalanceUserType.New && (
              <Alert className="ml-8">
                <Info className="h-4 w-4" />
                <AlertTitle>No Opening Balance Required</AlertTitle>
                <AlertDescription>
                  First year of both business establishment and Accounter usage — opening balance is
                  not required.
                </AlertDescription>
              </Alert>
            )}

            {/* ── Missing config ── */}
            {!statusInfo && !fetching && (
              <Alert className="ml-8">
                <Info className="h-4 w-4" />
                <AlertTitle>Configuration Incomplete</AlertTitle>
                <AlertDescription>
                  Could not determine user type. Please verify <strong>initialAccounterYear</strong>{' '}
                  and <strong>dateEstablished</strong> are set in Settings &rsaquo; Admin Context.
                </AlertDescription>
              </Alert>
            )}

            {/* ── MIGRATING: substep checklist + approval ── */}
            {statusInfo?.userType === AnnualAuditOpeningBalanceUserType.Migrating && (
              <>
                <MigratingSubsteps
                  year={year}
                  adminBusinessId={adminBusinessId}
                  balanceChargeId={statusInfo.balanceChargeId ?? null}
                />

                <div className="pl-8">
                  <ApprovalControl
                    ownerId={adminBusinessId}
                    year={year}
                    stepId={props.id}
                    initialStatus={persistedStep03Record?.status as AnnualAuditStepStatus}
                    initialNotes={persistedManualNotes}
                    onSaved={setApprovalStatus}
                  />
                </div>
              </>
            )}

            {/* ── CONTINUING: review link + approval ── */}
            {statusInfo?.userType === AnnualAuditOpeningBalanceUserType.Continuing && (
              <>
                <Alert className="ml-8">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Verify Prior-Year Closing Balance</AlertTitle>
                  <AlertDescription className="pb-4">
                    Prior-year closing balances are already in the system. Review the prior-year
                    data and approve once confirmed.
                  </AlertDescription>
                  <a
                    href={ROUTES.REPORTS.TRIAL_BALANCE({
                      toDate: `${year - 1}-12-31` as TimelessDateString,
                      ownerIds: [adminBusinessId],
                    })}
                    target="_blank"
                    rel="noreferrer"
                    onClick={event => event.stopPropagation()}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    View prior-year ({year - 1}) trial balance →
                  </a>
                </Alert>
                <div className="pl-8">
                  <ApprovalControl
                    ownerId={adminBusinessId}
                    year={year}
                    stepId={props.id}
                    initialStatus={persistedStep03Record?.status as AnnualAuditStepStatus}
                    initialNotes={persistedManualNotes}
                    onSaved={setApprovalStatus}
                  />
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}
