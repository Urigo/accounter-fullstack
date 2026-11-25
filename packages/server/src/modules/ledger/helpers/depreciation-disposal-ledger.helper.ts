import type { Injector } from 'graphql-modules';
import { EMPTY_UUID } from '../../../shared/constants.js';
import type { Currency } from '../../../shared/enums.js';
import {
  formatStringifyAmount,
  getTimelessDateYear,
  roundToAgorot,
} from '../../../shared/helpers/index.js';
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
  loadDisposalLocalCost,
  storedRefundMode,
  type DisposalComputation,
} from '../../depreciation/helpers/depreciation-disposals.helper.js';
import type {
  IGetDepreciationDisposalsByIdsResult,
  IGetDepreciationRecordsByIdsResult,
} from '../../depreciation/types.js';
import {
  netCreditToAccount,
  REFUND_ACCOUNT_HINT,
} from './depreciation-refund-exchange-ledger.helper.js';

export type DisposalLedgerAccounts = {
  /** The asset's cost account: the tax category of the charge that bought it */
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  /**
   * Where the event's charge booked the money (its tax category): a sale's proceeds, or the refund
   * of a cost refund. For a cost refund the charge has no credit note for, the charge's counterparty
   * instead: the refund record itself books the refund against it. When it is not the asset
   * account, the money is moved from it to the asset account.
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
 * A cost refund corrects the cost: it is ordinary income, never a gain or loss. Either the refund
 * charge's own entries (a credit note) credit the refund to `proceedsAccountId`, or, without one,
 * `proceedsAccountId` is the charge's counterparty and the refund record is the refund document.
 * On top of those:
 * - the cost reduction is moved from there to the asset account (Dr proceeds account or
 *   counterparty / Cr asset), unless the refund was booked to the asset account already;
 * - the depreciation the refund reverses (the recapture, or the excess over book value) is released
 *   as income (Dr AD / Cr depreciation correction).
 *
 * `foreign` is given for a cost refund entered in the currency of a foreign-currency asset: every
 * row then carries that currency, the rate the refund converted at and the foreign amount (local ÷
 * rate, rounded to cents), like the foreign misc-expense rows; the cost-reduction row takes the
 * refunded amount itself, so it ties to the refund. Local amounts are unchanged.
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
  foreign?: {
    currency: Currency;
    /** local currency per unit of `currency`, as the refund converted at */
    rate: number;
    /** the refunded amount, in `currency` */
    originalAmount: number;
  } | null;
}): { entries: LedgerProto[]; errors: string[] } {
  const { disposal, result, accounts, chargeId, ownerId, currency } = params;
  const errors: string[] = [];
  const entries: LedgerProto[] = [];
  const isCostRefund = disposal.kind === 'COST_REFUND';
  const label = `${isCostRefund ? 'Asset cost refund' : 'Asset disposal'}${
    params.assetLabel ? ` (${params.assetLabel})` : ''
  }`;

  const { foreign } = params;
  const add = (
    amount: number,
    debitAccountId: string,
    creditAccountId: string,
    what: string,
    foreignAmount?: number,
  ) => {
    if (Math.abs(amount) < 0.005) {
      return;
    }
    // in cents of the foreign currency
    const foreignValue = foreign
      ? (foreignAmount ?? roundToAgorot(Math.abs(amount) / foreign.rate))
      : undefined;
    entries.push({
      id: EMPTY_UUID,
      chargeId,
      ownerId,
      invoiceDate: disposal.disposalDate,
      valueDate: disposal.disposalDate,
      currency: foreign?.currency ?? currency,
      currencyRate: foreign?.rate ?? 1,
      isCreditorCounterparty: true,
      debitAccountID1: debitAccountId,
      creditAccountID1: creditAccountId,
      ...(foreignValue != null && { debitAmount1: foreignValue, creditAmount1: foreignValue }),
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
      add(
        result.costReduction,
        proceedsAccountId,
        assetAccountId,
        'cost reduction',
        foreign?.originalAmount,
      );
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

/**
 * An asset's cost account: its own asset account when set (one charge buying several assets, e.g.
 * an acquisition booked through misc expenses), else the tax category of the charge that bought it
 */
export async function getAssetAccountId(
  record: Pick<IGetDepreciationRecordsByIdsResult, 'asset_tax_category_id' | 'charge_id'>,
  injector: Injector,
): Promise<string | null | undefined> {
  return record.asset_tax_category_id ?? getChargeTaxCategoryId(record.charge_id, injector);
}

export type DisposalsLedger = {
  entries: LedgerProto[];
  errors: string[];
  /**
   * What the charge's own entries should credit to its proceeds account for the events in
   * `proceedsDisposals`, in local currency: the sales' proceeds plus the cost refunds' cost
   * reductions. `null` when there is nothing to check: no sale or cost refund among those events,
   * or an event's rows could not be built (its error is reported in `errors`), so that no check or
   * exchange row acts on money that was never moved out of the proceeds account.
   */
  expectedProceeds: number | null;
  /**
   * The events whose money the charge books to its tax category (the sales, and the cost refunds
   * of a credit note), which `expectedProceeds` covers
   */
  proceedsDisposals: IGetDepreciationDisposalsByIdsResult[];
  /**
   * The cost refunds whose record books them against the charge's counterparty (no credit note to
   * the tax category): nothing to check here, the counterparty's balance checks them
   */
  counterpartyRefunds: IGetDepreciationDisposalsByIdsResult[];
};

/**
 * Ledger entries for events booked on `charge`: the sales and cost refunds the charge carries the
 * money for, or the yearly depreciation charge's write-offs that have no charge of their own.
 *
 * `chargeProceedsAccountId` is the tax category the charge credits the money to; leave it unset
 * for events without money booked by the charge.
 *
 * `chargeEntries` are the charge's own document, transaction, fee and misc-expense entries, without
 * the disposal rows, and `documentEntries` the document entries among them. With them, a cost
 * refund is booked one of two ways:
 * - by a credit note: a document (a credit invoice) net-credits the charge's tax category in the
 *   refund's currency (its foreign currency when entered in one, else the local currency). The cost
 *   reduction is moved from there (Dr tax category / Cr asset), and the refund is checked with the
 *   sales in `expectedProceeds` (`checkDisposalProceeds`, or the in-currency check and exchange
 *   entry of `generateCostRefundExchangeLedger`, both against `chargeEntries`);
 * - by the refund record itself, without such a document: the cost reduction is booked against
 *   `counterpartyAccountId`, the charge's main business (Dr counterparty / Cr asset, in the refund's
 *   currency), and settles against the money the charge receives from it. The refund is left out of
 *   `expectedProceeds`; the charge's business balance checks it, and books the exchange-rate
 *   difference to the payment's rate. A refund with neither a credit note nor a counterparty is an
 *   error.
 * Only documents count as a credit note: misc expenses, transactions and fees crediting the tax
 * category don't stand in for one, whatever the tax category is (the asset account included, which
 * carries the charge's other movements, such as the refund of an asset that is not depreciated).
 * Booking both (a credit note crediting the asset account, and the record) counts the refund twice;
 * the counterparty is then left unbalanced, which the charge's business balance reports.
 *
 * Sales always take the charge's tax category. Without `chargeEntries` (the yearly depreciation
 * charge), every event takes it.
 */
export async function generateDepreciationDisposalsLedger(
  disposals: readonly IGetDepreciationDisposalsByIdsResult[],
  charge: { id: string; owner_id: string },
  injector: Injector,
  chargeProceedsAccountId?: string | null,
  chargeEntries?: readonly LedgerProto[],
  counterpartyAccountId?: string | null,
  documentEntries?: readonly LedgerProto[],
): Promise<DisposalsLedger> {
  if (disposals.length === 0) {
    return {
      entries: [],
      errors: [],
      expectedProceeds: null,
      proceedsDisposals: [],
      counterpartyRefunds: [],
    };
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
      proceedsDisposals: [],
      counterpartyRefunds: [],
    };
  }

  const entries: LedgerProto[] = [];
  const errors: string[] = [];
  let expectedProceeds = 0;
  let carriesMoney = false;
  let rowsMissing = false;
  const proceedsDisposals: IGetDepreciationDisposalsByIdsResult[] = [];
  const counterpartyRefunds: IGetDepreciationDisposalsByIdsResult[] = [];
  const documentCredits = new Map<string, ReturnType<typeof netCreditToAccount>>();
  /** What the charge's documents net-credit to an account: in `currency`, else locally */
  const documentCreditTo = (accountId: string, currency: Currency | null): number => {
    let credit = documentCredits.get(accountId);
    if (!credit) {
      credit = netCreditToAccount(documentEntries ?? [], accountId);
      documentCredits.set(accountId, credit);
    }
    return currency ? (credit.foreign.get(currency) ?? 0) : credit.local;
  };

  for (const disposal of disposals) {
    try {
      const [{ record }, result] = await Promise.all([
        loadAssetContext(injector, disposal.depreciation_id),
        computeStoredDisposal(injector, disposal),
      ]);
      const [assetCharge, assetAccountId] = await Promise.all([
        injector.get(ChargesProvider).getChargeByIdLoader.load(record.charge_id),
        getAssetAccountId(record, injector),
      ]);
      // a refund entered in the asset's currency books its rows in that currency
      let foreign: { currency: Currency; rate: number; originalAmount: number } | null = null;
      if (disposal.original_amount != null && disposal.original_currency) {
        const { rate } = await loadDisposalLocalCost(injector, disposal);
        if (!rate) {
          rowsMissing = true;
          errors.push(
            `Asset disposal ${disposal.id}: no rate to book it in ${disposal.original_currency}`,
          );
          continue;
        }
        foreign = {
          currency: disposal.original_currency as Currency,
          rate,
          originalAmount: Number(disposal.original_amount),
        };
      }
      if (!assetAccountId) {
        rowsMissing = true;
        errors.push(
          `Asset disposal ${disposal.id}: the asset has no account: set its asset account, or a tax category on the charge that bought it`,
        );
        continue;
      }

      // a cost refund without a credit-note document to the charge's tax category, in its
      // currency, is booked by its record, against the charge's counterparty
      const byRecord =
        !!chargeEntries &&
        disposal.type === 'COST_REFUND' &&
        !(
          chargeProceedsAccountId &&
          documentCreditTo(chargeProceedsAccountId, foreign?.currency ?? null) >= 0.005
        );
      if (byRecord && !counterpartyAccountId) {
        rowsMissing = true;
        errors.push(
          `Asset cost refund ${disposal.id}: the refund charge has no counterparty, nor a credit note to its tax category, to take the refund from`,
        );
        continue;
      }
      const proceedsAccountId = byRecord ? counterpartyAccountId : chargeProceedsAccountId;

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
        foreign,
      });
      entries.push(...built.entries);
      errors.push(...built.errors);
      if (byRecord) {
        counterpartyRefunds.push(disposal);
        continue;
      }
      proceedsDisposals.push(disposal);
      carriesMoney ||= disposal.type === 'SALE' || disposal.type === 'COST_REFUND';
      if (disposal.type === 'SALE') {
        expectedProceeds += result.proceeds;
      } else if (disposal.type === 'COST_REFUND') {
        expectedProceeds += result.costReduction;
      }
    } catch (e) {
      rowsMissing = true;
      errors.push(`Asset disposal ${disposal.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    entries,
    errors,
    expectedProceeds: carriesMoney && !rowsMissing ? expectedProceeds : null,
    proceedsDisposals,
    counterpartyRefunds,
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
 *
 * `expectedProceeds` covers only the events booked to the proceeds account, not the cost refunds
 * booked by their record against the charge's counterparty.
 */
export function checkDisposalProceeds(params: {
  expectedProceeds: number;
  proceedsAccountId: string;
  /** The proceeds account's name for the error; its id when not given */
  proceedsAccountName?: string;
  chargeEntries: readonly LedgerProto[];
}): string | null {
  const credited = netLocalCredit(params.chargeEntries, params.proceedsAccountId);
  const diff = credited - params.expectedProceeds;
  if (Math.abs(diff) <= 0.005) {
    return null;
  }
  return `Sales and cost refunds of depreciated assets come to ${formatStringifyAmount(params.expectedProceeds)}, but the charge credits ${formatStringifyAmount(credited)} to its tax category "${params.proceedsAccountName ?? params.proceedsAccountId}" (${formatStringifyAmount(diff)} diff): ${REFUND_ACCOUNT_HINT}`;
}
