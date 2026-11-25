import type { Injector } from 'graphql-modules';
import { EMPTY_UUID } from '../../../shared/constants.js';
import type { Currency } from '../../../shared/enums.js';
import { formatStringifyAmount, roundToAgorot } from '../../../shared/helpers/index.js';
import type { LedgerProto, TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { IGetDepreciationDisposalsByIdsResult } from '../../depreciation/types.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';

/*
 * A cost refund of an asset recorded in a foreign currency is entered in that currency and corrects
 * the asset's cost at the asset's cost-basis rate (see `convertForeignRefund`). The refund charge's
 * own entries (the supplier's credit note) credit the refund account P at the charge's rate, so the
 * cost-reduction rows leave P with the difference: an exchange-rate difference on the refund
 * receivable. It replaces the local-currency proceeds check (`checkDisposalProceeds`) for such a
 * charge: the refunds are checked in their currency instead, and the local gap is booked.
 */

/** What a ledger error about a refund booked to the wrong account suggests */
export const REFUND_ACCOUNT_HINT =
  "book the refund with a credit-note document to the charge's tax category, or leave it to the refund record, which books it against the charge's counterparty (misc expenses don't stand in for a credit note)";

/** An account's name for a ledger error: its financial entity's name, else its id */
export async function getLedgerAccountName(injector: Injector, accountId: string): Promise<string> {
  try {
    const entity = await injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByIdLoader.load(accountId);
    return entity?.name ?? accountId;
  } catch {
    return accountId;
  }
}

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

/**
 * The in-currency check and exchange-rate entry of a charge carrying cost refunds entered in their
 * asset's foreign currency:
 * - in each refund currency, the refunded amounts must add up to what the charge's own entries
 *   credit to P in that currency; otherwise it's a ledger error, and no exchange entry is booked.
 *   A refund of a foreign-currency asset invoiced in the local currency (an ILS credit note for a
 *   USD asset) is not supported: it fails this check;
 * - the exchange difference is what the charge's own entries credit to P in local currency, less
 *   `expectedProceeds` (the events' local proceeds and cost reductions, which the disposal rows
 *   move out of P). A loss is Dr exchange rates / Cr P, a gain Dr P / Cr exchange rates, so P ends
 *   at 0. It's rounded to agorot, dated the (last) refund date.
 *
 * `chargeEntries` are the charge's own document, transaction and misc-expense entries, without the
 * disposal rows.
 */
export function buildCostRefundExchangeEntries(params: {
  refunds: readonly ForeignCostRefund[];
  expectedProceeds: number;
  chargeEntries: readonly LedgerProto[];
  proceedsAccountId: string;
  /** P's name for the errors; its id when not given */
  proceedsAccountName?: string;
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
        `Cost refunds of a foreign-currency asset must be invoiced in that currency, for the amounts refunded (${formatStringifyAmount(refunded)} ${currency} refunded, ${formatStringifyAmount(credited)} ${currency} credited to the charge's tax category "${params.proceedsAccountName ?? proceedsAccountId}"): ${REFUND_ACCOUNT_HINT}`,
      );
    }
  }
  if (errors.length > 0) {
    return { entries: [], errors };
  }

  const difference = roundToAgorot(credit.local - params.expectedProceeds);
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
 *
 * Such a charge may carry no other events (sales, or refunds entered in the local currency): their
 * proceeds would be checked in the local currency, where the exchange difference would hide a
 * mismatch. A mix is a ledger error. Only the events booked to P count: pass the
 * `proceedsDisposals` of `generateDepreciationDisposalsLedger`, without the refunds whose record
 * books them against the charge's counterparty (`counterpartyRefunds`).
 */
export async function generateCostRefundExchangeLedger(params: {
  disposals: readonly IGetDepreciationDisposalsByIdsResult[];
  proceedsAccountId: string;
  expectedProceeds: number;
  charge: { id: string; owner_id: string };
  chargeEntries: readonly LedgerProto[];
  injector: Injector;
}): Promise<{ entries: LedgerProto[]; errors: string[] }> {
  const others = params.disposals.filter(disposal => disposal.original_amount == null);
  if (others.length > 0 && others.length < params.disposals.length) {
    return {
      entries: [],
      errors: [
        `The charge carries cost refunds entered in an asset's foreign currency together with other asset events (${others
          .map(disposal => disposal.id)
          .join(', ')}); book them on separate charges`,
      ],
    };
  }

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

  const [
    {
      defaultLocalCurrency,
      general: {
        taxCategories: { exchangeRateTaxCategoryId },
      },
    },
    proceedsAccountName,
  ] = await Promise.all([
    params.injector.get(AdminContextProvider).getVerifiedAdminContext(),
    getLedgerAccountName(params.injector, params.proceedsAccountId),
  ]);

  return buildCostRefundExchangeEntries({
    refunds,
    expectedProceeds: params.expectedProceeds,
    chargeEntries: params.chargeEntries,
    proceedsAccountId: params.proceedsAccountId,
    proceedsAccountName,
    exchangeRateAccountId: exchangeRateTaxCategoryId,
    chargeId: params.charge.id,
    ownerId: params.charge.owner_id,
    localCurrency: defaultLocalCurrency,
  });
}
