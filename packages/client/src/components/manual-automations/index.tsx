import { useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleCheckBig,
  ExternalLink,
  MinusCircle,
  Unplug,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ManualAutomationStep, ManualAutomationStepState } from '../../gql/graphql.js';
import { useRunManualAutomations } from '../../hooks/use-run-manual-automations.js';
import { UserContext } from '../../providers/index.js';
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
import { canRunManualAutomations } from './manual-automations-access.js';
import {
  groupAutomationEvents,
  summarizeAutomationEvents,
  type AutomationStepView,
  type DeelCharge,
  type FilledDebitDate,
  type FlaggedFee,
  type ManualAutomationsRunEvent,
  type MergedCharges,
} from './manual-automations-events.js';

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

function StepStateIcon({ state }: { state: AutomationStepView['state'] }): ReactElement {
  switch (state) {
    case ManualAutomationStepState.Running:
      return <Spinner className="size-5" />;
    case ManualAutomationStepState.Succeeded:
      return <CheckCircle2 className="size-5 text-green-600" aria-label="Succeeded" />;
    case ManualAutomationStepState.CompletedWithErrors:
      return <AlertTriangle className="size-5 text-amber-500" aria-label="Completed with errors" />;
    case ManualAutomationStepState.Failed:
      return <XCircle className="size-5 text-destructive" aria-label="Failed" />;
    case ManualAutomationStepState.Skipped:
      return <MinusCircle className="size-5 text-muted-foreground" aria-label="Skipped" />;
    case ManualAutomationStepState.NotConfigured:
      return <Unplug className="size-5 text-muted-foreground" aria-label="Not configured" />;
    default:
      return <Circle className="size-5 text-muted-foreground" aria-label="Pending" />;
  }
}

function StepCard({
  title,
  step,
  itemsCount,
  notConfiguredHint,
  children,
}: {
  title: string;
  step: AutomationStepView;
  itemsCount: number;
  /** Shown when the step did not run because its integration is not set up */
  notConfiguredHint?: ReactNode;
  children: ReactNode;
}): ReactElement {
  const isDone =
    step.state === ManualAutomationStepState.Succeeded ||
    step.state === ManualAutomationStepState.CompletedWithErrors;

  let placeholder: ReactNode = null;
  if (step.state === 'PENDING') {
    placeholder = 'Waiting for previous steps';
  } else if (step.state === ManualAutomationStepState.Skipped) {
    placeholder = 'Skipped, because a previous step failed';
  } else if (step.state === ManualAutomationStepState.NotConfigured) {
    placeholder = notConfiguredHint ?? 'Not configured for this business';
  } else if (itemsCount === 0 && isDone) {
    placeholder = 'Nothing to update';
  } else if (itemsCount === 0 && step.state === ManualAutomationStepState.Running) {
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
              {step.state === ManualAutomationStepState.Failed
                ? 'Step failed'
                : 'Some items failed'}
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
          <div className="text-sm text-muted-foreground">{placeholder}</div>
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

function DeelChargesTable({ charges }: { charges: DeelCharge[] }): ReactElement {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Charge</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Invoices</TableHead>
          <TableHead>Change</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {charges.map(({ charge, isNew, invoiceCount }) => (
          <TableRow key={charge.id}>
            <TableCell>
              <ChargeLink chargeId={charge.id}>
                {charge.counterparty?.name ?? charge.userDescription ?? 'Charge'}
              </ChargeLink>
              {charge.counterparty?.name && charge.userDescription && (
                <div className="text-xs text-muted-foreground">{charge.userDescription}</div>
              )}
            </TableCell>
            <TableCell>{formatDate(charge.minDocumentsDate)}</TableCell>
            <TableCell>{charge.totalAmount?.formatted}</TableCell>
            <TableCell>{invoiceCount}</TableCell>
            <TableCell>
              <Badge variant={isNew ? 'default' : 'outline'}>{isNew ? 'New' : 'Updated'}</Badge>
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
  /** Adds a column for the debit date the automations filled in */
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

const PAGE_TITLE = 'Manual Automations';
const PAGE_DESCRIPTION =
  'Flag foreign transfer fees, merge charges that share a transaction reference, fill missing credit card debit dates, and pull Deel documents';

type ManualAutomationsViewProps = {
  /** True from the moment the run starts until its last streamed event arrives. */
  running: boolean;
  /** Events of the current run received so far. */
  events: readonly ManualAutomationsRunEvent[];
  onRun: () => void;
  /** The admin business, whose Admin Config tab is where Deel gets connected */
  adminBusinessId?: string | null;
  /** False when the server would refuse the run; the screen then explains instead of offering it. */
  canRun?: boolean;
};

/** The manual automations screen, driven by props, so its states can be rendered without a server. */
export function ManualAutomationsView({
  running,
  events,
  onRun,
  adminBusinessId,
  canRun = true,
}: ManualAutomationsViewProps): ReactElement {
  const { steps, flaggedFees, mergedCharges, filledDebitDates, deelCharges } = useMemo(
    () => groupAutomationEvents(events),
    [events],
  );
  const hasRun = running || events.length > 0;

  if (!canRun) {
    return (
      <PageLayout title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <Alert>
          <AlertTitle>Only business owners can run automations</AlertTitle>
          <AlertDescription>
            Running the manual automations requires the business owner role in the selected
            business. Ask a business owner to run them, or, if you own one of your businesses,
            narrow the business scope to it.
          </AlertDescription>
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      headerActions={
        <ConfirmationModal
          onConfirm={onRun}
          title="Are you sure you want to run the manual automations?"
        >
          <Button disabled={running}>
            {running ? <Spinner /> : <CircleCheckBig className="size-4" />}
            Run automations
          </Button>
        </ConfirmationModal>
      }
    >
      {hasRun ? (
        <div className="flex flex-col gap-4">
          {!running && (
            <p className="text-sm text-muted-foreground">
              {summarizeAutomationEvents(events).description}
            </p>
          )}
          <StepCard
            title="Transactions flagged as fees"
            step={steps[ManualAutomationStep.FlagForeignFees]}
            itemsCount={flaggedFees.length}
          >
            <TransactionsTable rows={flaggedFees} />
          </StepCard>
          <StepCard
            title="Merged charges"
            step={steps[ManualAutomationStep.MergeChargesByReference]}
            itemsCount={mergedCharges.length}
          >
            <MergedChargesTable merges={mergedCharges} />
          </StepCard>
          <StepCard
            title="Credit card debit dates filled"
            step={steps[ManualAutomationStep.FillCreditcardDebitDates]}
            itemsCount={filledDebitDates.length}
          >
            <TransactionsTable rows={filledDebitDates} debitDateHeader="Debit date set" />
          </StepCard>
          <StepCard
            title="Deel documents pulled"
            step={steps[ManualAutomationStep.FetchDeelDocuments]}
            itemsCount={deelCharges.length}
            notConfiguredHint={
              <>
                Deel isn&apos;t connected for this business.
                {adminBusinessId && (
                  <>
                    {' '}
                    <Link
                      to={{
                        pathname: ROUTES.BUSINESSES.DETAIL(adminBusinessId),
                        search: '?tab=admin-config',
                      }}
                      className="text-primary hover:underline"
                    >
                      Connect it in Admin Config
                    </Link>
                  </>
                )}
              </>
            }
          >
            <DeelChargesTable charges={deelCharges} />
          </StepCard>
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No run yet</EmptyTitle>
            <EmptyDescription>
              Run the automations to see every change they make. Results are shown for the current
              run only. Changes already made stay in place even if a later step fails.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </PageLayout>
  );
}

export function ManualAutomations(): ReactElement {
  const { running, events, runJobs } = useRunManualAutomations();
  const { userContext } = useContext(UserContext);
  return (
    <ManualAutomationsView
      running={running}
      events={events}
      onRun={() => void runJobs()}
      adminBusinessId={userContext?.context.adminBusinessId}
      canRun={canRunManualAutomations(userContext?.context)}
    />
  );
}
