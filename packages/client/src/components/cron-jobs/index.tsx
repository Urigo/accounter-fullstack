import { useMemo, type ReactElement, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleCheckBig,
  ExternalLink,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CronJobStep, CronJobStepState } from '../../gql/graphql.js';
import { useRunCronJobs } from '../../hooks/use-run-cron-jobs.js';
import { ROUTES } from '../../router/routes.js';
import { ConfirmationModal } from '../common/modals/confirmation-modal.js';
import { Tooltip } from '../common/tooltip.js';
import { PageLayout } from '../layout/page-layout.js';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty.js';
import { Spinner } from '../ui/spinner.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import {
  groupCronJobEvents,
  summarizeCronJobEvents,
  type CronJobStepView,
  type FilledDebitDate,
  type FlaggedFee,
  type MergedCharges,
} from './cron-jobs-events.js';

/** Renders a date-only (`YYYY-MM-DD`) or ISO date-time value; date-only values stay local. */
function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }
  return format(typeof value === 'string' ? parseISO(value) : value, 'dd/MM/yy');
}

function ChargeLink({
  chargeId,
  children,
}: {
  chargeId: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Link
      to={ROUTES.CHARGES.DETAIL(chargeId)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {children}
      <ExternalLink className="size-3 shrink-0" />
    </Link>
  );
}

function StepStateIcon({ state }: { state: CronJobStepView['state'] }): ReactElement {
  switch (state) {
    case CronJobStepState.Running:
      return <Spinner className="size-5" />;
    case CronJobStepState.Succeeded:
      return <CheckCircle2 className="size-5 text-green-600" aria-label="Succeeded" />;
    case CronJobStepState.CompletedWithErrors:
      return <AlertTriangle className="size-5 text-amber-500" aria-label="Completed with errors" />;
    case CronJobStepState.Failed:
      return <XCircle className="size-5 text-destructive" aria-label="Failed" />;
    case CronJobStepState.Skipped:
      return <MinusCircle className="size-5 text-muted-foreground" aria-label="Skipped" />;
    default:
      return <Circle className="size-5 text-muted-foreground" aria-label="Pending" />;
  }
}

function StepCard({
  title,
  step,
  itemsCount,
  children,
}: {
  title: string;
  step: CronJobStepView;
  itemsCount: number;
  children: ReactNode;
}): ReactElement {
  const isDone =
    step.state === CronJobStepState.Succeeded ||
    step.state === CronJobStepState.CompletedWithErrors;

  let placeholder: string | null = null;
  if (step.state === 'PENDING') {
    placeholder = 'Waiting for previous steps';
  } else if (step.state === CronJobStepState.Skipped) {
    placeholder = 'Skipped, because a previous step failed';
  } else if (itemsCount === 0 && isDone) {
    placeholder = 'Nothing to update';
  } else if (itemsCount === 0 && step.state === CronJobStepState.Running) {
    placeholder = 'Running…';
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <StepStateIcon state={step.state} />
        <CardTitle className="text-base">{title}</CardTitle>
        {(itemsCount > 0 || isDone) && <Badge variant="secondary">{itemsCount}</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {step.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>
              {step.state === CronJobStepState.Failed ? 'Step failed' : 'Some items failed'}
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {step.errors.map(error => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {placeholder ? (
          <p className="text-sm text-muted-foreground">{placeholder}</p>
        ) : (
          itemsCount > 0 && children
        )}
      </CardContent>
    </Card>
  );
}

function MergedChargesTable({ merges }: { merges: MergedCharges[] }): ReactElement {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Charge</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Merged in</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {merges.map(({ reference, baseCharge, mergedCharges }) => (
          <TableRow key={baseCharge.id}>
            <TableCell className="font-mono">{reference}</TableCell>
            <TableCell>
              <ChargeLink chargeId={baseCharge.id}>
                {baseCharge.counterparty?.name ?? baseCharge.userDescription ?? 'Charge'}
              </ChargeLink>
              {baseCharge.counterparty?.name && baseCharge.userDescription && (
                <div className="text-xs text-muted-foreground">{baseCharge.userDescription}</div>
              )}
            </TableCell>
            <TableCell>{formatDate(baseCharge.minEventDate)}</TableCell>
            <TableCell>{baseCharge.totalAmount?.formatted}</TableCell>
            <TableCell>
              <Tooltip
                content={
                  <ul>
                    {mergedCharges.map(charge => (
                      <li key={charge.id}>
                        {[formatDate(charge.date), charge.amount?.formatted, charge.description]
                          .filter(Boolean)
                          .join(' · ') || charge.id}
                      </li>
                    ))}
                  </ul>
                }
              >
                <Badge variant="outline" className="cursor-default">
                  +{mergedCharges.length}
                </Badge>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TransactionsTable({
  rows,
  debitDateHeader,
}: {
  rows: (FlaggedFee | FilledDebitDate)[];
  /** Adds a column for the debit date the cron jobs filled in */
  debitDateHeader?: string;
}): ReactElement {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Description</TableHead>
          {debitDateHeader && <TableHead>{debitDateHeader}</TableHead>}
          <TableHead>Charge</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.transaction.id}>
            <TableCell>{formatDate(row.transaction.eventDate)}</TableCell>
            <TableCell>{row.transaction.account.name}</TableCell>
            <TableCell>{row.transaction.amount.formatted}</TableCell>
            <TableCell className="max-w-80 truncate" title={row.transaction.sourceDescription}>
              {row.transaction.sourceDescription}
            </TableCell>
            {debitDateHeader && (
              <TableCell>{'debitDate' in row ? formatDate(row.debitDate) : null}</TableCell>
            )}
            <TableCell>
              <ChargeLink chargeId={row.transaction.chargeId}>Open</ChargeLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CronJobs(): ReactElement {
  const { running, events, runJobs } = useRunCronJobs();
  const { steps, flaggedFees, mergedCharges, filledDebitDates } = useMemo(
    () => groupCronJobEvents(events),
    [events],
  );
  const hasRun = running || events.length > 0;

  return (
    <PageLayout
      title="Cron Jobs"
      description="Flag foreign transfer fees, merge charges that share a transaction reference, and fill missing credit card debit dates"
      headerActions={
        <ConfirmationModal
          onConfirm={() => void runJobs()}
          title="Are you sure you want to manually execute cron jobs?"
        >
          <Button disabled={running}>
            {running ? <Spinner /> : <CircleCheckBig className="size-4" />}
            Run cron jobs
          </Button>
        </ConfirmationModal>
      }
    >
      {hasRun ? (
        <div className="flex flex-col gap-4">
          {!running && (
            <p className="text-sm text-muted-foreground">
              {summarizeCronJobEvents(events).description}
            </p>
          )}
          <StepCard
            title="Transactions flagged as fees"
            step={steps[CronJobStep.FlagForeignFees]}
            itemsCount={flaggedFees.length}
          >
            <TransactionsTable rows={flaggedFees} />
          </StepCard>
          <StepCard
            title="Merged charges"
            step={steps[CronJobStep.MergeChargesByReference]}
            itemsCount={mergedCharges.length}
          >
            <MergedChargesTable merges={mergedCharges} />
          </StepCard>
          <StepCard
            title="Credit card debit dates filled"
            step={steps[CronJobStep.FillCreditcardDebitDates]}
            itemsCount={filledDebitDates.length}
          >
            <TransactionsTable rows={filledDebitDates} debitDateHeader="Debit date set" />
          </StepCard>
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No run yet</EmptyTitle>
            <EmptyDescription>
              Run the cron jobs to see every change they make. Results are shown for the current run
              only. Changes already made stay in place even if a later step fails.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </PageLayout>
  );
}
