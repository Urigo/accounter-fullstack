import type { Injector } from 'graphql-modules';
import { EMPTY_UUID } from '../../../shared/constants.js';
import type { Currency } from '../../../shared/enums.js';
import type { LedgerProto, TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { getChargeTaxCategoryId } from '../../charges/helpers/common.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { AssetDisposalResult } from '../../depreciation/helpers/asset-depreciation.helper.js';
import {
  computeStoredDisposal,
  loadAssetContext,
} from '../../depreciation/helpers/depreciation-disposals.helper.js';
import type { IGetDepreciationDisposalsByIdsResult } from '../../depreciation/types.js';

export type DisposalLedgerAccounts = {
  /** The asset's cost account: the tax category of the charge that bought it */
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  /**
   * Where the disposal charge booked the proceeds (its tax category). When it is not the asset
   * account, the proceeds are moved from it to the asset account.
   */
  proceedsAccountId?: string | null;
  gainAccountId?: string | null;
  lossAccountId?: string | null;
};

/**
 * The entries that take a disposed slice off the books, dated the disposal date.
 *
 * The disposal charge's own entries credit the proceeds to `proceedsAccountId` (the asset account,
 * for a refund categorised like the purchase). On top of those:
 * - proceeds booked elsewhere are moved to the asset account (Dr proceeds account / Cr asset);
 * - the slice's accumulated depreciation is released against the asset (Dr AD / Cr asset);
 * - the gain is credited (Dr asset / Cr gain), or the loss debited (Dr loss / Cr asset).
 * Together they credit the asset with exactly the disposed cost beyond the proceeds, so the asset
 * account keeps the remaining cost and accumulated depreciation the remaining depreciation.
 */
export function buildDisposalLedgerEntries(params: {
  disposal: { id: string; disposalDate: TimelessDateString; description?: string | null };
  result: AssetDisposalResult;
  accounts: DisposalLedgerAccounts;
  chargeId: string;
  ownerId: string;
  currency: Currency;
  assetLabel?: string | null;
}): { entries: LedgerProto[]; errors: string[] } {
  const { disposal, result, accounts, chargeId, ownerId, currency } = params;
  const errors: string[] = [];
  const entries: LedgerProto[] = [];
  const label = params.assetLabel ? ` (${params.assetLabel})` : '';

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
      description: `Asset disposal${label}: ${what}`,
    });
  };

  const { assetAccountId, accumulatedDepreciationAccountId, proceedsAccountId } = accounts;

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
 * Ledger entries for disposals booked on `chargeId`: the sale or refund charge carrying them, or
 * the yearly depreciation charge for write-offs that have none.
 *
 * `proceedsAccountId` is the tax category the charge credits the proceeds to; leave it unset for
 * disposals without proceeds booked by the charge.
 */
export async function generateDepreciationDisposalsLedger(
  disposals: readonly IGetDepreciationDisposalsByIdsResult[],
  charge: { id: string; owner_id: string },
  injector: Injector,
  proceedsAccountId?: string | null,
): Promise<{ entries: LedgerProto[]; errors: string[] }> {
  if (disposals.length === 0) {
    return { entries: [], errors: [] };
  }
  const {
    defaultLocalCurrency,
    depreciation: {
      accumulatedDepreciationTaxCategoryId,
      disposalGainTaxCategoryId,
      disposalLossTaxCategoryId,
    },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

  if (!accumulatedDepreciationTaxCategoryId) {
    return {
      entries: [],
      errors: ['Accumulated depreciation tax category is not defined'],
    };
  }

  const entries: LedgerProto[] = [];
  const errors: string[] = [];

  for (const disposal of disposals) {
    try {
      const [{ record }, result] = await Promise.all([
        loadAssetContext(injector, disposal.depreciation_id),
        computeStoredDisposal(injector, disposal),
      ]);
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
          disposalDate: disposal.disposal_date,
          description: disposal.description,
        },
        result,
        accounts: {
          assetAccountId,
          accumulatedDepreciationAccountId: accumulatedDepreciationTaxCategoryId,
          proceedsAccountId: result.proceeds > 0 ? proceedsAccountId : null,
          gainAccountId: disposalGainTaxCategoryId,
          lossAccountId: disposalLossTaxCategoryId,
        },
        chargeId: charge.id,
        ownerId: charge.owner_id,
        currency: defaultLocalCurrency,
        assetLabel: disposal.description ?? assetCharge?.user_description,
      });
      entries.push(...built.entries);
      errors.push(...built.errors);
    } catch (e) {
      errors.push(`Asset disposal ${disposal.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { entries, errors };
}
