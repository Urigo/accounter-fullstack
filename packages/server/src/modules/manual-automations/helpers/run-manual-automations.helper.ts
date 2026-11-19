import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type {
  ManualAutomationStep,
  ManualAutomationStepState,
  ManualAutomationStepStatus,
  MergedChargeSnapshot,
} from '../../../__generated__/types.js';
import { ChargeTypeEnum } from '../../../shared/enums.js';
import { formatFinancialAmount } from '../../../shared/helpers/amount.js';
import { minTimelessDate } from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { forgetDerivedChargeType, getChargeType } from '../../charges/helpers/charge-type.js';
import {
  getChargeBusinesses,
  getChargeDocumentsMeta,
} from '../../charges/helpers/common.helper.js';
import { mergeChargesExecutor } from '../../charges/helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import { syncDeelDocuments } from '../../deel/helpers/sync-deel-documents.helper.js';
import { ProviderCredentialsProvider } from '../../provider-credentials/providers/provider-credentials.provider.js';
import type { StatementKey } from '../../transactions/helpers/creditcard-statement-matcher.helper.js';
import { autoLinkCreditCardStatements } from '../../transactions/helpers/link-creditcard-statements.helper.js';
import {
  CreditCardStatementsProvider,
  type BankTransactionRow,
} from '../../transactions/providers/creditcard-statements.provider.js';
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
      /** The charge, when the link re-flagged it for accountant review */
      degradedCharge: IGetChargesByIdsResult | null;
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
  // a reference or card name only counts on a debit to one of the owner's card issuers
  const { financialAccounts } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const filled = await injector.get(ManualAutomationsProvider).calculateCreditcardDebitDate({
    ownerId,
    creditCardBusinessIds: [...financialAccounts.creditCardIds],
  });
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
 * Stored links drive the ledger and the charge type, so a link that changes how a charge is booked
 * re-flags the charge for accountant review. Links that only record what the ledger already did (a
 * charge that already was a card debit, now linked to the card account its reference resolved to)
 * do not, so the first backfill doesn't re-flag the whole card history. That is decided before the
 * links are written, from the charge as it was.
 */
async function* linkCreditcardStatements(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<ManualAutomationEventProto, StepOutcome, undefined> {
  const { financialAccounts } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const linking = autoLinkCreditCardStatements(injector, {
    ownerId,
    creditCardBusinessIds: financialAccounts.creditCardIds,
    assessLink: (bankRow, links) => creditcardLinksChangeAccounting(injector, bankRow, links),
  });
  const errors: string[] = [];
  let next = await linking.next();
  while (!next.done) {
    const { bankTransactionId, chargeId, method, statements, changesAccounting } = next.value;
    let degradedCharge: IGetChargesByIdsResult | null = null;
    // the charge's type may have changed with the link
    forgetDerivedChargeType(injector, chargeId);
    if (changesAccounting) {
      try {
        const degraded = await degradeChargesAccountantApproval(injector, [chargeId]);
        degradedCharge = degraded.get(chargeId) ?? null;
      } catch (error) {
        errors.push(
          `Linked bank transaction ID=${bankTransactionId} to its card statements, but failed to flag charge ID=${chargeId} for accountant review: ${errorMessage(error)}`,
        );
      }
    }
    yield {
      __typename: 'CreditcardStatementsLinked',
      bankTransaction: bankTransactionId,
      method,
      statements,
      degradedCharge,
    };
    next = await linking.next();
  }
  return {
    affectedCount: next.value.linkedCount,
    errors: [...next.value.errors, ...errors],
  };
}

/**
 * Whether linking an approved charge's bank debit to these card statements changes how the charge
 * is booked. A link only records what the ledger already did when all of these hold, and then the
 * charge is not re-flagged:
 * - the charge already was a card debit;
 * - it has no relevant documents, and its main business is one of the owner's internal wallets
 *   (the conditions under which the ledger booked an unlinked debit against a card account);
 * - the linked card account is exactly the account the ledger booked it against: the owner's
 *   only financial account numbered as the debit's reference.
 * Charges that are not approved have nothing to re-flag.
 */
export async function creditcardLinksChangeAccounting(
  injector: Injector,
  bankRow: Pick<BankTransactionRow, 'id' | 'charge_id'>,
  links: readonly StatementKey[],
): Promise<boolean> {
  const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(bankRow.charge_id);
  if (!charge || charge.accountant_status !== 'APPROVED') {
    return false;
  }

  const [chargeType, { mainBusinessId }, { invoiceCount, receiptCount }, adminContext] =
    await Promise.all([
      getChargeType(charge, injector),
      getChargeBusinesses(charge, injector),
      getChargeDocumentsMeta(charge, injector),
      injector.get(AdminContextProvider).getVerifiedAdminContext(),
    ]);
  if (chargeType !== ChargeTypeEnum.CreditcardBankCharge) {
    return true;
  }
  const bookedByReference =
    invoiceCount + receiptCount === 0 &&
    !!mainBusinessId &&
    adminContext.financialAccounts.internalWalletsIds.includes(mainBusinessId);
  if (!bookedByReference) {
    return true;
  }

  const legacyAccountIds = await injector
    .get(CreditCardStatementsProvider)
    .getLegacyReferenceAccountIdsByBankTransactionIdLoader.load(bankRow.id);
  const linkedAccountIds = new Set(links.map(link => link.cardAccountId));
  const keepsLegacyAccount =
    legacyAccountIds.length === 1 &&
    linkedAccountIds.size === 1 &&
    linkedAccountIds.has(legacyAccountIds[0]);
  return !keepsLegacyAccount;
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
