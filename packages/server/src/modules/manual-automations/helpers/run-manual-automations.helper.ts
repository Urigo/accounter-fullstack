import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type {
  ManualAutomationStep,
  ManualAutomationStepState,
  ManualAutomationStepStatus,
  MergedChargeSnapshot,
} from '../../../__generated__/types.js';
import { formatFinancialAmount } from '../../../shared/helpers/amount.js';
import { minTimelessDate } from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { mergeChargesExecutor } from '../../charges/helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import { syncDeelDocuments } from '../../deel/helpers/sync-deel-documents.helper.js';
import { ProviderCredentialsProvider } from '../../provider-credentials/providers/provider-credentials.provider.js';
import { autoLinkCreditCardStatements } from '../../transactions/helpers/link-creditcard-statements.helper.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import type { ResolvedCreditCardStatement } from '../../transactions/types.js';
import { ManualAutomationsProvider } from '../providers/manual-automations.provider.js';
import type { IGetReferenceMergeCandidatesResult } from '../types.js';
import {
  buildMergeChargesByTransactionReferencePlan,
  type MergeChargePlan,
} from './merge-charges-by-reference.helper.js';

export type ManualAutomationEventProto =
  | ({ __typename: 'ManualAutomationStepStatus' } & ManualAutomationStepStatus)
  | { __typename: 'ForeignFeeTransactionFlagged'; transaction: string }
  | {
      __typename: 'ChargesMergedByReference';
      reference: string;
      baseCharge: IGetChargesByIdsResult;
      mergedCharges: MergedChargeSnapshot[];
    }
  | { __typename: 'CreditcardDebitDateFilled'; transaction: string; debitDate: TimelessDateString }
  | {
      __typename: 'CreditcardStatementsLinked';
      bankTransaction: string;
      method: 'REFERENCE' | 'AMOUNT';
      statements: ResolvedCreditCardStatement[];
    }
  | {
      __typename: 'DeelChargeSynced';
      charge: IGetChargesByIdsResult;
      isNew: boolean;
      invoiceCount: number;
    };

type StepOutcome = {
  affectedCount: number;
  errors: string[];
  /** Overrides the end state, which otherwise follows from `errors` */
  state?: Extract<ManualAutomationStepState, 'NOT_CONFIGURED'>;
};

type StepRunner = (
  injector: Injector,
  ownerId: string,
) => AsyncGenerator<ManualAutomationEventProto, StepOutcome, undefined>;

function stepStatus(
  step: ManualAutomationStep,
  state: ManualAutomationStepState,
  outcome?: Partial<StepOutcome>,
): ManualAutomationEventProto {
  return {
    __typename: 'ManualAutomationStepStatus',
    step,
    state,
    affectedCount: outcome?.affectedCount ?? null,
    errors: outcome?.errors?.length ? outcome.errors : null,
  };
}

/**
 * A cause whose message is written for users: a `GraphQLError`, or a plain `Error` thrown by our
 * own helpers. Subclasses (pg's `DatabaseError`, `ZodError`, `TypeError`, …) carry internals such
 * as table and constraint names or raw validation dumps, so they stay in the server logs.
 */
function isDisplayableCause(error: unknown): error is Error {
  return (
    error instanceof GraphQLError ||
    (error instanceof Error && Object.getPrototypeOf(error) === Error.prototype)
  );
}

/**
 * The error's message, followed by the message of its deepest displayable cause: wrapping helpers
 * (e.g. "Error fetching Deel invoices") keep the useful detail in the cause. The walk stops at the
 * first cause that isn't displayable; the full error is logged by the caller.
 */
function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error';
  }
  let shownCause: Error | null = null;
  let current: Error = error;
  while (isDisplayableCause(current.cause)) {
    shownCause = current.cause;
    current = current.cause;
  }
  return shownCause ? `${error.message}: ${shownCause.message}` : error.message;
}

/**
 * Runs the manual automation steps in order, yielding a status event when each step starts and ends, and
 * an event for every change a step makes. A failed step skips the steps after it; a step that
 * completes with item-level errors, or that is not configured for the business, does not.
 */
export async function* runManualAutomations(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<ManualAutomationEventProto, void, undefined> {
  const steps: [ManualAutomationStep, StepRunner][] = [
    ['FLAG_FOREIGN_FEES', flagForeignFees],
    ['MERGE_CHARGES_BY_REFERENCE', mergeChargesByReference],
    ['FILL_CREDITCARD_DEBIT_DATES', fillCreditcardDebitDates],
    // after the debit dates are filled, so card statements are complete
    ['LINK_CREDITCARD_STATEMENTS', linkCreditcardStatements],
    // last, so a Deel failure (API, credentials, unknown contract) never blocks the fix-ups
    ['FETCH_DEEL_DOCUMENTS', fetchDeelDocuments],
  ];

  let failed = false;
  for (const [step, run] of steps) {
    if (failed) {
      yield stepStatus(step, 'SKIPPED');
      continue;
    }

    yield stepStatus(step, 'RUNNING');
    try {
      const outcome = yield* run(injector, ownerId);
      yield stepStatus(
        step,
        outcome.state ?? (outcome.errors.length ? 'COMPLETED_WITH_ERRORS' : 'SUCCEEDED'),
        outcome,
      );
    } catch (error) {
      failed = true;
      console.error(`Manual automation step ${step} failed:`, error);
      yield stepStatus(step, 'FAILED', { errors: [errorMessage(error)] });
    }
  }
}

async function* flagForeignFees(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<ManualAutomationEventProto, StepOutcome, undefined> {
  const flagged = await injector
    .get(ManualAutomationsProvider)
    .flagForeignFeeTransactions({ ownerId });
  const transactionsProvider = injector.get(TransactionsProvider);
  for (const { id } of flagged) {
    transactionsProvider.transactionByIdLoader.clear(id);
    yield { __typename: 'ForeignFeeTransactionFlagged', transaction: id };
  }
  return { affectedCount: flagged.length, errors: [] };
}

async function* mergeChargesByReference(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<ManualAutomationEventProto, StepOutcome, undefined> {
  const { candidates, chargeById, plans, errors } = await loadReferenceMergePlans(
    injector,
    ownerId,
  );
  const stepErrors = [...errors];
  let mergedCount = 0;

  for (const plan of plans) {
    // Snapshot before merging: the merged charges are deleted by the merge
    const mergedCharges = buildMergedChargeSnapshots(plan.chargeIdsToMerge, candidates, chargeById);
    let merge: Awaited<ReturnType<typeof executeReferenceMergePlan>>;
    try {
      merge = await executeReferenceMergePlan(injector, plan, chargeById);
    } catch (error) {
      stepErrors.push(
        `Failed to merge reference "${plan.reference}" into charge ID=${plan.baseChargeId}: ${errorMessage(error)}`,
      );
      continue;
    }

    mergedCount++;
    if (merge.approvalError) {
      stepErrors.push(merge.approvalError);
    }
    if (!merge.baseCharge) {
      stepErrors.push(
        `Merged reference "${plan.reference}", but charge ID=${plan.baseChargeId} could not be loaded`,
      );
      continue;
    }
    yield {
      __typename: 'ChargesMergedByReference',
      reference: plan.reference,
      baseCharge: merge.baseCharge,
      mergedCharges,
    };
  }

  return { affectedCount: mergedCount, errors: stepErrors };
}

async function* fillCreditcardDebitDates(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<ManualAutomationEventProto, StepOutcome, undefined> {
  const filled = await injector
    .get(ManualAutomationsProvider)
    .calculateCreditcardDebitDate({ ownerId });
  const transactionsProvider = injector.get(TransactionsProvider);
  let filledCount = 0;
  for (const { id, debit_date_override } of filled) {
    transactionsProvider.transactionByIdLoader.clear(id);
    if (!debit_date_override) {
      continue;
    }
    filledCount++;
    yield {
      __typename: 'CreditcardDebitDateFilled',
      transaction: id,
      debitDate: debit_date_override,
    };
  }
  return { affectedCount: filledCount, errors: [] };
}

/**
 * Persists confident bank-debit ⇄ card-statement links (also the history backfill).
 *
 * Unlike the merge step, it does not re-flag charges for accountant review: in this phase a link
 * drives neither the ledger nor the charge type, only the card statements a charge shows. Whether
 * it should once the ledger reads the links is decided with that change.
 */
async function* linkCreditcardStatements(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<ManualAutomationEventProto, StepOutcome, undefined> {
  const { financialAccounts } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const linking = autoLinkCreditCardStatements(injector, {
    ownerId,
    creditCardBusinessIds: financialAccounts.creditCardIds,
  });
  let next = await linking.next();
  while (!next.done) {
    const { bankTransactionId, method, statements } = next.value;
    yield {
      __typename: 'CreditcardStatementsLinked',
      bankTransaction: bankTransactionId,
      method,
      statements,
    };
    next = await linking.next();
  }
  return { affectedCount: next.value.linkedCount, errors: next.value.errors };
}

// The sync runs for the admin context's owner, the same one the run gets, so it takes no ownerId
async function* fetchDeelDocuments(
  injector: Injector,
): AsyncGenerator<ManualAutomationEventProto, StepOutcome, undefined> {
  const credentials = await injector.get(ProviderCredentialsProvider).getDeelCredentials();
  if (!credentials?.apiToken) {
    return { affectedCount: 0, errors: [], state: 'NOT_CONFIGURED' };
  }

  // The sync only knows which charges are left once it cleans up empty ones at the end, so its
  // changes are reported together, after it is done
  const { charges } = await syncDeelDocuments(injector);
  for (const { charge, isNew, invoiceCount } of charges) {
    yield { __typename: 'DeelChargeSynced', charge, isNew, invoiceCount };
  }
  return { affectedCount: charges.length, errors: [] };
}

async function loadReferenceMergePlans(injector: Injector, ownerId: string) {
  const candidates = await injector.get(ManualAutomationsProvider).getReferenceMergeCandidates({
    ownerId,
  });

  const chargeIds = new Set<string>(candidates.map(candidate => candidate.charge_id));
  const charges = await injector
    .get(ChargesProvider)
    .getChargeByIdLoader.loadMany(Array.from(chargeIds))
    .then(
      res => res.filter(charge => charge && !(charge instanceof Error)) as IGetChargesByIdsResult[],
    );

  const chargeById = new Map(charges.map(charge => [charge.id, charge]));
  const { plans, errors } = buildMergeChargesByTransactionReferencePlan({
    candidates,
    chargeById,
  });

  return { candidates, chargeById, plans, errors };
}

/**
 * Merges the plan's charges into its base charge and re-flags the base charge for accountant
 * review. Throws only when the merge itself fails, so nothing was merged. A failed re-flag comes
 * back as `approvalError`: the merge is already committed by then, and must still be reported.
 */
async function executeReferenceMergePlan(
  injector: Injector,
  { reference, baseChargeId, chargeIdsToMerge }: MergeChargePlan,
  chargeById: Map<string, IGetChargesByIdsResult>,
): Promise<{ baseCharge: IGetChargesByIdsResult | undefined; approvalError?: string }> {
  await mergeChargesExecutor(chargeIdsToMerge, baseChargeId, injector);
  try {
    const degradedCharges = await degradeChargesAccountantApproval(injector, [baseChargeId]);
    const degradedBaseCharge = degradedCharges.get(baseChargeId);
    if (degradedBaseCharge) {
      // keep the cached charge in sync with its fresh (PENDING) state
      chargeById.set(baseChargeId, degradedBaseCharge);
    }
  } catch (error) {
    return {
      baseCharge: chargeById.get(baseChargeId),
      approvalError: `Merged reference "${reference}" into charge ID=${baseChargeId}, but failed to flag it for accountant review: ${errorMessage(error)}`,
    };
  }
  return { baseCharge: chargeById.get(baseChargeId) };
}

/**
 * Describes charges that are about to be merged (and deleted), from their matched transactions.
 */
export function buildMergedChargeSnapshots(
  chargeIds: readonly string[],
  candidates: readonly IGetReferenceMergeCandidatesResult[],
  chargeById: ReadonlyMap<string, IGetChargesByIdsResult>,
): MergedChargeSnapshot[] {
  return chargeIds.map(id => {
    const transactions = candidates.filter(candidate => candidate.charge_id === id);

    const earliestDate = minTimelessDate(...transactions.map(({ event_date }) => event_date));

    const currencies = new Set(transactions.map(transaction => transaction.currency));
    const amount =
      currencies.size === 1
        ? formatFinancialAmount(
            transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0),
            transactions[0].currency,
          )
        : null;

    const description =
      chargeById.get(id)?.user_description?.trim() ||
      transactions.find(transaction => transaction.source_description?.trim())
        ?.source_description ||
      null;

    return {
      id,
      description,
      date: earliestDate,
      amount,
    };
  });
}
