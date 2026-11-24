import type { Injector } from 'graphql-modules';
import { EMPTY_UUID } from '../../../shared/constants.js';
import type { Currency } from '../../../shared/enums.js';
import { formatStringifyAmount } from '../../../shared/helpers/index.js';
import type { LedgerProto, TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { IGetDepreciationDisposalsByIdsResult } from '../../depreciation/types.js';

/*
 * A cost refund of an asset recorded in a foreign currency is entered in that currency and corrects
 * the asset's cost at the asset's cost-basis rate (see `convertForeignRefund`). The refund charge's
 * own entries (the supplier's credit note) credit the refund account P at the charge's rate, so the
 * cost-reduction rows leave P with the difference: an exchange-rate difference on the refund
 * receivable. It replaces the local-currency proceeds check (`checkDisposalProceeds`) for such a
 * charge: the refunds are checked in their currency instead, and the local gap is booked.
 */

/** A cost refund carried by the charge, entered in its asset's foreign currency */
export type ForeignCostRefund = {
  id: string;
  /** the asset's currency, which the refund was entered in */
  currency: Currency;
  originalAmount: number;
  disposalDate: TimelessDateString;
};

/** Whether any of the events is a cost refund entered in its asset's foreign currency */
export function hasForeignCurrencyRefunds(
  disposals: readonly Pick<IGetDepreciationDisposalsByIdsResult, 'original_amount'>[],
): boolean {
  return disposals.some(disposal => disposal.original_amount != null);
}

/** What `entries` net-credit to `accountId`: in local currency, and per foreign currency */
export function netCreditToAccount(
  entries: readonly LedgerProto[],
  accountId: string,
): { local: number; foreign: Map<Currency, number> } {
  let local = 0;
  const foreign = new Map<Currency, number>();
  const addForeign = (currency: Currency, amount: number | undefined, sign: 1 | -1) => {
    if (amount == null) {
      return;
    }
    foreign.set(currency, (foreign.get(currency) ?? 0) + sign * amount);
  };
  for (const entry of entries) {
    if (entry.creditAccountID1 === accountId) {
      local += entry.localCurrencyCreditAmount1;
      addForeign(entry.currency, entry.creditAmount1, 1);
    }
    if (entry.creditAccountID2 === accountId) {
      local += entry.localCurrencyCreditAmount2 ?? 0;
      addForeign(entry.currency, entry.creditAmount2, 1);
    }
    if (entry.debitAccountID1 === accountId) {
      local -= entry.localCurrencyDebitAmount1;
      addForeign(entry.currency, entry.debitAmount1, -1);
    }
    if (entry.debitAccountID2 === accountId) {
      local -= entry.localCurrencyDebitAmount2 ?? 0;
      addForeign(entry.currency, entry.debitAmount2, -1);
    }
  }
  return { local, foreign };
}

function toAgorot(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * The in-currency check and exchange-rate entry of a charge carrying cost refunds entered in their
 * asset's foreign currency:
 * - in each refund currency, the refunded amounts must add up to what the charge's own entries
 *   credit to P in that currency; otherwise it's a ledger error, and no exchange entry is booked;
 * - the exchange difference is what the charge's own entries credit to P in local currency, less
 *   `expectedProceeds` (the events' local proceeds and cost reductions, which the disposal rows
 *   move out of P). A loss is Dr exchange rates / Cr P, a gain Dr P / Cr exchange rates, so P ends
 *   at 0. It's in agorot, dated the (last) refund date.
 *
 * `chargeEntries` are the charge's own document, transaction and misc-expense entries, without the
 * disposal rows.
 */
export function buildCostRefundExchangeEntries(params: {
  refunds: readonly ForeignCostRefund[];
  expectedProceeds: number;
  chargeEntries: readonly LedgerProto[];
  proceedsAccountId: string;
  exchangeRateAccountId?: string | null;
  chargeId: string;
  ownerId: string;
  localCurrency: Currency;
}): { entries: LedgerProto[]; errors: string[] } {
  const { refunds, chargeEntries, proceedsAccountId, chargeId, ownerId, localCurrency } = params;
  if (refunds.length === 0) {
    return { entries: [], errors: [] };
  }
  const errors: string[] = [];
  const credit = netCreditToAccount(chargeEntries, proceedsAccountId);

  const refundedPerCurrency = new Map<Currency, number>();
  for (const refund of refunds) {
    refundedPerCurrency.set(
      refund.currency,
      (refundedPerCurrency.get(refund.currency) ?? 0) + refund.originalAmount,
    );
  }
  for (const [currency, refunded] of refundedPerCurrency) {
    const credited = credit.foreign.get(currency) ?? 0;
    if (Math.abs(refunded - credited) > 0.005) {
      errors.push(
        `Cost refunds of ${formatStringifyAmount(refunded)} ${currency} don't match the ${formatStringifyAmount(credited)} ${currency} the charge credits to its tax category`,
      );
    }
  }
  if (errors.length > 0) {
    return { entries: [], errors };
  }

  const difference = toAgorot(credit.local - params.expectedProceeds);
  if (Math.abs(difference) < 0.005) {
    return { entries: [], errors: [] };
  }
  if (!params.exchangeRateAccountId) {
    return {
      entries: [],
      errors: ['Exchange rate tax category is not defined (cost refund exchange difference)'],
    };
  }

  const date = refunds.reduce(
    (latest, refund) => (refund.disposalDate > latest ? refund.disposalDate : latest),
    refunds[0].disposalDate,
  );
  const amount = Math.abs(difference);
  // a positive difference leaves P with a credit: a gain
  const isGain = difference > 0;
  return {
    entries: [
      {
        id: EMPTY_UUID,
        chargeId,
        ownerId,
        invoiceDate: date,
        valueDate: date,
        currency: localCurrency,
        currencyRate: 1,
        isCreditorCounterparty: true,
        debitAccountID1: isGain ? proceedsAccountId : params.exchangeRateAccountId,
        creditAccountID1: isGain ? params.exchangeRateAccountId : proceedsAccountId,
        localCurrencyDebitAmount1: amount,
        localCurrencyCreditAmount1: amount,
        description: 'Asset cost refund: exchange rate difference',
      },
    ],
    errors: [],
  };
}

/**
 * The in-currency check and exchange-rate entry of the cost refunds among `disposals` that were
 * entered in their asset's foreign currency (see `buildCostRefundExchangeEntries`).
 * `proceedsAccountId` is P, the charge's tax category, and `expectedProceeds` what
 * `generateDepreciationDisposalsLedger` found the events move out of it.
 */
export async function generateCostRefundExchangeLedger(params: {
  disposals: readonly IGetDepreciationDisposalsByIdsResult[];
  proceedsAccountId: string;
  expectedProceeds: number;
  charge: { id: string; owner_id: string };
  chargeEntries: readonly LedgerProto[];
  injector: Injector;
}): Promise<{ entries: LedgerProto[]; errors: string[] }> {
  const refunds: ForeignCostRefund[] = [];
  const errors: string[] = [];
  for (const disposal of params.disposals) {
    if (disposal.original_amount == null) {
      continue;
    }
    if (!disposal.original_currency) {
      errors.push(`Asset cost refund ${disposal.id} has an amount but no currency`);
      continue;
    }
    refunds.push({
      id: disposal.id,
      currency: disposal.original_currency as Currency,
      originalAmount: Number(disposal.original_amount),
      disposalDate: disposal.disposal_date,
    });
  }
  if (errors.length > 0 || refunds.length === 0) {
    return { entries: [], errors };
  }

  const {
    defaultLocalCurrency,
    general: {
      taxCategories: { exchangeRateTaxCategoryId },
    },
  } = await params.injector.get(AdminContextProvider).getVerifiedAdminContext();

  return buildCostRefundExchangeEntries({
    refunds,
    expectedProceeds: params.expectedProceeds,
    chargeEntries: params.chargeEntries,
    proceedsAccountId: params.proceedsAccountId,
    exchangeRateAccountId: exchangeRateTaxCategoryId,
    chargeId: params.charge.id,
    ownerId: params.charge.owner_id,
    localCurrency: defaultLocalCurrency,
  });
}
