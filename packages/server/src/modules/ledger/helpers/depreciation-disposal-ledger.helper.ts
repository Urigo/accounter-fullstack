import type { Injector } from 'graphql-modules';
import { EMPTY_UUID } from '../../../shared/constants.js';
import type { Currency } from '../../../shared/enums.js';
import { formatStringifyAmount, getTimelessDateYear } from '../../../shared/helpers/index.js';
import type { LedgerProto, TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { getChargeTaxCategoryId } from '../../charges/helpers/common.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import {
  DEFAULT_COST_REFUND_MODE,
  type CostRefundMode,
  type DepreciationDisposalKind,
} from '../../depreciation/helpers/asset-depreciation.helper.js';
import {
  computeStoredDisposal,
  loadAssetContext,
  storedRefundMode,
  type DisposalComputation,
} from '../../depreciation/helpers/depreciation-disposals.helper.js';
import type { IGetDepreciationDisposalsByIdsResult } from '../../depreciation/types.js';

export type DisposalLedgerAccounts = {
  /** The asset's cost account: the tax category of the charge that bought it */
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  /**
   * Where the event's charge booked the money (its tax category): a sale's proceeds, or the refund
   * of a cost refund. When it is not the asset account, the money is moved from it to the asset
   * account.
   */
  proceedsAccountId?: string | null;
  gainAccountId?: string | null;
  lossAccountId?: string | null;
  /** Ordinary income for the depreciation a cost refund reverses (its recapture or excess) */
  correctionAccountId?: string | null;
};

/**
 * The years whose depreciation a cost refund's correction reverses, as "2023" or "2021-2023": from
 * activation to the year before the refund for a refund from activation (the refund year itself
 * depreciates the corrected cost), or to the refund year for a refund from the refund date (the
 * depreciation up to the refund date is part of the book value it exceeds).
 */
export function correctedYears(
  activationDate: TimelessDateString,
  refundDate: TimelessDateString,
  mode: CostRefundMode,
): string {
  const from = getTimelessDateYear(activationDate);
  const refundYear = getTimelessDateYear(refundDate);
  const to = mode === 'FROM_ACTIVATION' ? refundYear - 1 : refundYear;
  return to > from ? `${from}-${to}` : String(from);
}

/**
 * The entries an event books on its charge, dated the event date.
 *
 * A sale or write-off takes the disposed slice off the books. The sale charge's own entries credit
 * the proceeds to `proceedsAccountId` (the asset account, when the sale is categorised like the
 * purchase). On top of those:
 * - proceeds booked elsewhere are moved to the asset account (Dr proceeds account / Cr asset);
 * - the slice's accumulated depreciation is released against the asset (Dr AD / Cr asset);
 * - the gain is credited (Dr asset / Cr gain), or the loss debited (Dr loss / Cr asset).
 * Together they credit the asset with exactly the disposed cost beyond the proceeds, so the asset
 * account keeps the remaining cost and accumulated depreciation the remaining depreciation.
 *
 * A cost refund corrects the cost: it is ordinary income, never a gain or loss. The refund charge's
 * own entries credit the refund to `proceedsAccountId`. On top of those:
 * - the cost reduction is moved from there to the asset account (Dr proceeds account / Cr asset),
 *   unless the refund was booked to the asset account already;
 * - the depreciation the refund reverses (the recapture, or the excess over book value) is released
 *   as income (Dr AD / Cr depreciation correction).
 */
export function buildDisposalLedgerEntries(params: {
  disposal: {
    id: string;
    kind: DepreciationDisposalKind;
    /** For a cost refund only; a missing mode is `FROM_ACTIVATION` */
    refundMode?: CostRefundMode | null;
    disposalDate: TimelessDateString;
  };
  /** The asset's activation date, to name the years a cost refund corrects */
  activationDate: TimelessDateString;
  result: DisposalComputation;
  accounts: DisposalLedgerAccounts;
  chargeId: string;
  ownerId: string;
  currency: Currency;
  assetLabel?: string | null;
}): { entries: LedgerProto[]; errors: string[] } {
  const { disposal, result, accounts, chargeId, ownerId, currency } = params;
  const errors: string[] = [];
  const entries: LedgerProto[] = [];
  const isCostRefund = disposal.kind === 'COST_REFUND';
  const label = `${isCostRefund ? 'Asset cost refund' : 'Asset disposal'}${
    params.assetLabel ? ` (${params.assetLabel})` : ''
  }`;

  const add = (amount: number, debitAccountId: string, creditAccountId: string, what: string) => {
    if (Math.abs(amount) < 0.005) {
      return;
    }
    entries.push({
      id: EMPTY_UUID,
      chargeId,
      ownerId,
      invoiceDate: disposal.disposalDate,
      valueDate: disposal.disposalDate,
      currency,
      currencyRate: 1,
      isCreditorCounterparty: true,
      debitAccountID1: debitAccountId,
      creditAccountID1: creditAccountId,
      localCurrencyDebitAmount1: Math.abs(amount),
      localCurrencyCreditAmount1: Math.abs(amount),
      description: `${label}: ${what}`,
    });
  };

  const { assetAccountId, accumulatedDepreciationAccountId, proceedsAccountId } = accounts;

  if (isCostRefund) {
    if (!proceedsAccountId) {
      if (result.costReduction >= 0.005) {
        errors.push(
          `Asset cost refund ${disposal.id}: the refund charge has no tax category to take the refund from`,
        );
      }
    } else if (proceedsAccountId !== assetAccountId) {
      add(result.costReduction, proceedsAccountId, assetAccountId, 'cost reduction');
    }

    if (result.depreciationCorrection >= 0.005) {
      if (accounts.correctionAccountId) {
        const years = correctedYears(
          params.activationDate,
          disposal.disposalDate,
          disposal.refundMode ?? DEFAULT_COST_REFUND_MODE,
        );
        add(
          result.depreciationCorrection,
          accumulatedDepreciationAccountId,
          accounts.correctionAccountId,
          `depreciation correction for ${years}`,
        );
      } else {
        errors.push('Depreciation correction tax category is not defined');
      }
    }

    return { entries, errors };
  }

  if (proceedsAccountId && proceedsAccountId !== assetAccountId) {
    add(result.proceeds, proceedsAccountId, assetAccountId, 'proceeds');
  }

  add(
    result.accumulatedDepreciation,
    accumulatedDepreciationAccountId,
    assetAccountId,
    'accumulated depreciation',
  );

  if (result.gainLoss > 0) {
    if (accounts.gainAccountId) {
      add(result.gainLoss, assetAccountId, accounts.gainAccountId, 'gain');
    } else {
      errors.push('Gain on disposal of fixed assets tax category is not defined');
    }
  } else if (result.gainLoss < 0) {
    if (accounts.lossAccountId) {
      add(result.gainLoss, accounts.lossAccountId, assetAccountId, 'loss');
    } else {
      errors.push('Loss on disposal of fixed assets tax category is not defined');
    }
  }

  return { entries, errors };
}

export type DisposalsLedger = {
  entries: LedgerProto[];
  errors: string[];
  /**
   * What the charge's own entries should credit to its proceeds account for these events, in local
   * currency: the sales' proceeds plus the cost refunds' cost reductions. `null` when there is
   * nothing to check: no sale or cost refund among the events, or one of them could not be computed
   * (its error is reported in `errors`).
   */
  expectedProceeds: number | null;
};

/**
 * Ledger entries for events booked on `charge`: the sales and cost refunds the charge carries the
 * money for, or the yearly depreciation charge's write-offs that have no charge of their own.
 *
 * `proceedsAccountId` is the tax category the charge credits the money to; leave it unset for
 * events without money booked by the charge.
 */
export async function generateDepreciationDisposalsLedger(
  disposals: readonly IGetDepreciationDisposalsByIdsResult[],
  charge: { id: string; owner_id: string },
  injector: Injector,
  proceedsAccountId?: string | null,
): Promise<DisposalsLedger> {
  if (disposals.length === 0) {
    return { entries: [], errors: [], expectedProceeds: null };
  }
  const {
    defaultLocalCurrency,
    depreciation: {
      accumulatedDepreciationTaxCategoryId,
      disposalGainTaxCategoryId,
      disposalLossTaxCategoryId,
      correctionTaxCategoryId,
    },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

  if (!accumulatedDepreciationTaxCategoryId) {
    return {
      entries: [],
      errors: ['Accumulated depreciation tax category is not defined'],
      expectedProceeds: null,
    };
  }

  const entries: LedgerProto[] = [];
  const errors: string[] = [];
  let expectedProceeds = 0;
  let carriesMoney = false;
  let incomplete = false;

  for (const disposal of disposals) {
    const carriesMoneyForEvent = disposal.type === 'SALE' || disposal.type === 'COST_REFUND';
    carriesMoney ||= carriesMoneyForEvent;
    try {
      const [{ record }, result] = await Promise.all([
        loadAssetContext(injector, disposal.depreciation_id),
        computeStoredDisposal(injector, disposal),
      ]);
      if (disposal.type === 'SALE') {
        expectedProceeds += result.proceeds;
      } else if (disposal.type === 'COST_REFUND') {
        expectedProceeds += result.costReduction;
      }
      const [assetCharge, assetAccountId] = await Promise.all([
        injector.get(ChargesProvider).getChargeByIdLoader.load(record.charge_id),
        getChargeTaxCategoryId(record.charge_id, injector),
      ]);
      if (!assetAccountId) {
        errors.push(
          `Asset disposal ${disposal.id}: the asset's charge has no tax category (asset account)`,
        );
        continue;
      }
      const built = buildDisposalLedgerEntries({
        disposal: {
          id: disposal.id,
          kind: disposal.type,
          refundMode: storedRefundMode(disposal),
          disposalDate: disposal.disposal_date,
        },
        activationDate: record.activation_date,
        result,
        accounts: {
          assetAccountId,
          accumulatedDepreciationAccountId: accumulatedDepreciationTaxCategoryId,
          proceedsAccountId,
          gainAccountId: disposalGainTaxCategoryId,
          lossAccountId: disposalLossTaxCategoryId,
          correctionAccountId: correctionTaxCategoryId,
        },
        chargeId: charge.id,
        ownerId: charge.owner_id,
        currency: defaultLocalCurrency,
        assetLabel: disposal.description ?? assetCharge?.user_description,
      });
      entries.push(...built.entries);
      errors.push(...built.errors);
    } catch (e) {
      incomplete ||= carriesMoneyForEvent;
      errors.push(`Asset disposal ${disposal.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    entries,
    errors,
    expectedProceeds: carriesMoney && !incomplete ? expectedProceeds : null,
  };
}

/** What `entries` net-credit to `accountId`, in local currency (debits count negative) */
function netLocalCredit(entries: readonly LedgerProto[], accountId: string): number {
  let credit = 0;
  for (const entry of entries) {
    if (entry.creditAccountID1 === accountId) {
      credit += entry.localCurrencyCreditAmount1;
    }
    if (entry.creditAccountID2 === accountId) {
      credit += entry.localCurrencyCreditAmount2 ?? 0;
    }
    if (entry.debitAccountID1 === accountId) {
      credit -= entry.localCurrencyDebitAmount1;
    }
    if (entry.debitAccountID2 === accountId) {
      credit -= entry.localCurrencyDebitAmount2 ?? 0;
    }
  }
  return credit;
}

/**
 * Checks that a charge carries the money for the sales and cost refunds linked to it: its own
 * entries (documents, transactions, misc expenses; not the disposal rows) must net-credit its
 * proceeds account with the events' proceeds and cost reductions, in local currency. Otherwise the
 * proceeds account is left with a balance. Returns a ledger error, or `null` when they match.
 */
export function checkDisposalProceeds(params: {
  expectedProceeds: number;
  proceedsAccountId: string;
  chargeEntries: readonly LedgerProto[];
}): string | null {
  const credited = netLocalCredit(params.chargeEntries, params.proceedsAccountId);
  const diff = credited - params.expectedProceeds;
  if (Math.abs(diff) <= 0.005) {
    return null;
  }
  return `Sales and cost refunds of depreciated assets come to ${formatStringifyAmount(params.expectedProceeds)}, but the charge credits ${formatStringifyAmount(credited)} to its tax category (${formatStringifyAmount(diff)} diff)`;
}
