import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { DepreciationCategoriesProvider } from '../providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from '../providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../providers/depreciation.provider.js';
import type {
  IGetAllDepreciationCategoriesResult,
  IGetDepreciationDisposalsByIdsResult,
  IGetDepreciationRecordsByIdsResult,
} from '../types.js';
import {
  computeDisposal,
  remainingAssetCost,
  validateAssetDisposals,
  validateDisposalKind,
  type AssetDepreciationInput,
  type AssetDisposalInput,
  type AssetDisposalResult,
  type DepreciationDisposalKind,
} from './asset-depreciation.helper.js';

export function toAssetInput(
  record: Pick<
    IGetDepreciationRecordsByIdsResult,
    'amount' | 'activation_date' | 'expiration_date'
  >,
  category: Pick<IGetAllDepreciationCategoriesResult, 'percentage'>,
): AssetDepreciationInput {
  return {
    cost: Number(record.amount ?? 0),
    depreciationRate: Number(category.percentage),
    activationDate: record.activation_date,
    expirationDate: record.expiration_date ?? undefined,
  };
}

export function toDisposalInput(
  disposal: Pick<
    IGetDepreciationDisposalsByIdsResult,
    'id' | 'disposal_date' | 'disposed_cost' | 'proceeds'
  >,
): AssetDisposalInput {
  return {
    id: disposal.id,
    disposalDate: disposal.disposal_date,
    disposedCost: Number(disposal.disposed_cost),
    proceeds: Number(disposal.proceeds),
  };
}

export type AssetContext = {
  record: IGetDepreciationRecordsByIdsResult;
  category: IGetAllDepreciationCategoriesResult;
  asset: AssetDepreciationInput;
  disposals: IGetDepreciationDisposalsByIdsResult[];
};

export async function loadAssetContext(
  injector: Injector,
  depreciationRecordId: string,
): Promise<AssetContext> {
  const [record, disposals] = await Promise.all([
    injector.get(DepreciationProvider).getDepreciationRecordByIdLoader.load(depreciationRecordId),
    injector
      .get(DepreciationDisposalsProvider)
      .getDisposalsByDepreciationIdLoader.load(depreciationRecordId),
  ]);
  if (!record) {
    throw new GraphQLError(`Depreciation record with id ${depreciationRecordId} not found`);
  }
  const category = await injector
    .get(DepreciationCategoriesProvider)
    .getDepreciationCategoriesByIdLoader.load(record.category);
  if (!category) {
    throw new GraphQLError(`Depreciation category with id ${record.category} not found`);
  }
  return { record, category, asset: toAssetInput(record, category), disposals };
}

/** Computed values of a stored disposal */
export async function computeStoredDisposal(
  injector: Injector,
  disposal: IGetDepreciationDisposalsByIdsResult,
): Promise<AssetDisposalResult> {
  const { asset, disposals } = await loadAssetContext(injector, disposal.depreciation_id);
  const result = computeDisposal(asset, disposals.map(toDisposalInput), disposal.id);
  if (!result) {
    throw new GraphQLError(`Unable to compute depreciation disposal ${disposal.id}`);
  }
  return result;
}

export const PREVIEW_DISPOSAL_ID = 'preview';

export type DisposalCandidate = {
  /** The stored disposal being edited, or undefined for a new one */
  id?: string;
  type: DepreciationDisposalKind;
  chargeId?: string | null;
  disposalDate: TimelessDateString;
  disposedCost: number;
  proceeds?: number | null;
};

/** Proceeds default to the refunded cost for a cost refund, and to 0 for a write-off */
export function resolveDisposalProceeds(candidate: DisposalCandidate): number {
  if (candidate.type === 'COST_REFUND') {
    return candidate.proceeds ?? candidate.disposedCost;
  }
  if (candidate.type === 'WRITE_OFF') {
    return candidate.proceeds ?? 0;
  }
  return candidate.proceeds ?? 0;
}

/** Whether a disposal dated `disposalDate` falls in the ledger's locked period */
export function isDisposalDateLocked(
  disposalDate: TimelessDateString,
  ledgerLock: TimelessDateString | null | undefined,
): boolean {
  return !!ledgerLock && disposalDate <= ledgerLock;
}

/**
 * Validates a new or edited disposal against its asset and the asset's other disposals, and
 * computes it. Returns the errors, or the computed result when valid.
 *
 * The asset and the linked charge must belong to the business the disposal is written for: RLS
 * lets a request read every business in its scope, but foreign keys are checked without RLS, so an
 * asset or charge of another business would otherwise load fine here and be linked to this one.
 */
export async function checkDisposal(
  injector: Injector,
  context: AssetContext,
  candidate: DisposalCandidate,
): Promise<
  | { errors: string[]; result?: never; remainingCost?: never }
  | { errors?: never; result: AssetDisposalResult; remainingCost: number }
> {
  const { record, asset, disposals } = context;
  const [{ defaultLocalCurrency, ledgerLock, ownerId }, charge] = await Promise.all([
    injector.get(AdminContextProvider).getVerifiedAdminContext(),
    candidate.chargeId
      ? injector.get(ChargesProvider).getChargeByIdLoader.load(candidate.chargeId)
      : undefined,
  ]);

  const proceeds = resolveDisposalProceeds(candidate);
  const errors = validateDisposalKind({
    type: candidate.type,
    disposedCost: candidate.disposedCost,
    proceeds,
    chargeId: candidate.chargeId,
  });

  if (record.owner_id !== ownerId) {
    errors.push('The depreciation record belongs to a different business');
  }
  if (candidate.chargeId) {
    if (!charge) {
      errors.push(`Charge with id ${candidate.chargeId} not found`);
    } else if (charge.owner_id !== ownerId) {
      errors.push(`Charge with id ${candidate.chargeId} belongs to a different business`);
    }
  }
  if (record.amount == null) {
    errors.push('Set an amount on the depreciation record before disposing of it');
  }
  if (record.currency && record.currency !== defaultLocalCurrency) {
    errors.push(
      `Disposals are only supported for assets recorded in ${defaultLocalCurrency} (this asset is in ${record.currency})`,
    );
  }
  const stored = candidate.id
    ? disposals.find(disposal => disposal.id === candidate.id)
    : undefined;
  if (stored && isDisposalDateLocked(stored.disposal_date, ledgerLock)) {
    // moving a disposal out of a closed period would change that period too
    errors.push(
      `The disposal is dated ${stored.disposal_date}, in the locked period (${ledgerLock}), and can't be changed`,
    );
  } else if (isDisposalDateLocked(candidate.disposalDate, ledgerLock)) {
    errors.push(`Disposal date ${candidate.disposalDate} is in the locked period (${ledgerLock})`);
  }

  const id = candidate.id ?? PREVIEW_DISPOSAL_ID;
  const all = [
    ...disposals.filter(disposal => disposal.id !== candidate.id).map(toDisposalInput),
    {
      id,
      disposalDate: candidate.disposalDate,
      disposedCost: candidate.disposedCost,
      proceeds,
    },
  ];
  errors.push(...validateAssetDisposals(asset, all));

  if (errors.length > 0) {
    return { errors };
  }

  const result = computeDisposal(asset, all, id);
  if (!result) {
    return { errors: ['Unable to compute the disposal'] };
  }
  return { result, remainingCost: remainingAssetCost(asset, all) };
}
