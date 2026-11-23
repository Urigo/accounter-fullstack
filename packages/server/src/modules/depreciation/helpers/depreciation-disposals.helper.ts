import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { getTimelessDateYear } from '../../../shared/helpers/index.js';
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
import { resolveAssetLocalCost, type AssetCostRecord } from './asset-cost.helper.js';
import {
  calculateAssetYear,
  computeCostRefund,
  computeDisposal,
  DEFAULT_COST_REFUND_MODE,
  validateAssetDisposals,
  validateDisposalKind,
  type AssetDepreciationInput,
  type AssetDisposalInput,
  type CostRefundMode,
  type DepreciationDisposalKind,
} from './asset-depreciation.helper.js';

/** The engine's input for an asset; `cost` is its cost basis in the local currency */
export function toAssetInput(
  record: Pick<IGetDepreciationRecordsByIdsResult, 'activation_date'>,
  category: Pick<IGetAllDepreciationCategoriesResult, 'percentage'>,
  cost: number | null,
): AssetDepreciationInput {
  return {
    cost: cost ?? 0,
    depreciationRate: Number(category.percentage),
    activationDate: record.activation_date,
  };
}

/**
 * The refund mode of a stored event: for a cost refund, its stored mode or the default when it has
 * none; `null` for a sale or write-off
 */
export function storedRefundMode(
  disposal: Pick<IGetDepreciationDisposalsByIdsResult, 'type' | 'refund_mode'>,
): CostRefundMode | null {
  return disposal.type === 'COST_REFUND'
    ? (disposal.refund_mode ?? DEFAULT_COST_REFUND_MODE)
    : null;
}

/**
 * The proceeds of a stored event. A cost refund has none: refunds stored before refund modes existed
 * hold the refunded cost in `proceeds`, which is ignored.
 */
export function storedProceeds(
  disposal: Pick<IGetDepreciationDisposalsByIdsResult, 'type' | 'proceeds'>,
): number {
  return disposal.type === 'COST_REFUND' ? 0 : Number(disposal.proceeds);
}

/** The engine's input for an asset, at its cost basis in the local currency */
export async function loadAssetInput(
  injector: Injector,
  record: AssetCostRecord,
  category: Pick<IGetAllDepreciationCategoriesResult, 'percentage'>,
): Promise<AssetDepreciationInput> {
  const { cost } = await resolveAssetLocalCost(injector, record);
  return toAssetInput(record, category, cost);
}

export function toDisposalInput(
  disposal: Pick<
    IGetDepreciationDisposalsByIdsResult,
    'id' | 'type' | 'refund_mode' | 'disposal_date' | 'disposed_cost' | 'proceeds'
  >,
): AssetDisposalInput {
  return {
    id: disposal.id,
    kind: disposal.type,
    refundMode: storedRefundMode(disposal),
    disposalDate: disposal.disposal_date,
    disposedCost: Number(disposal.disposed_cost),
    proceeds: storedProceeds(disposal),
  };
}

export type AssetContext = {
  record: IGetDepreciationRecordsByIdsResult;
  category: IGetAllDepreciationCategoriesResult;
  /** the asset's cost basis in the local currency, or null when the record has no amount */
  localCost: number | null;
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
  const { cost } = await resolveAssetLocalCost(injector, record);
  return {
    record,
    category,
    localCost: cost,
    asset: toAssetInput(record, category, cost),
    disposals,
  };
}

/**
 * Computed values of one event, in local currency (costs and depreciation in whole shekels,
 * proceeds as given):
 * - a sale or write-off: the disposed slice, its accumulated depreciation, book value and gain or
 *   loss; no cost reduction and no depreciation correction.
 * - a cost refund: the cost reduction and the depreciation correction (ordinary income: the
 *   recapture for `FROM_ACTIVATION`, the excess over book value for `FROM_REFUND_DATE`). It has no
 *   proceeds and no gain or loss; `accumulatedDepreciation` is the depreciation the refund reverses
 *   (the correction) and `netBookValue` is the cost reduction minus it.
 */
export type DisposalComputation = {
  disposedCost: number;
  proceeds: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  gainLoss: number;
  costReduction: number;
  depreciationCorrection: number;
};

/** Computes one event of an asset, given all of the asset's events; `null` for an unknown id */
export function computeAssetEvent(
  asset: AssetDepreciationInput,
  events: readonly AssetDisposalInput[],
  eventId: string,
): DisposalComputation | null {
  const event = events.find(e => e.id === eventId);
  if (!event) {
    return null;
  }
  if (event.kind === 'COST_REFUND') {
    const refund = computeCostRefund(asset, events, eventId);
    if (!refund) {
      return null;
    }
    const correction = refund.recapture + refund.excessIncome;
    return {
      disposedCost: refund.costReduction,
      proceeds: 0,
      accumulatedDepreciation: correction,
      netBookValue: refund.costReduction - correction,
      gainLoss: 0,
      costReduction: refund.costReduction,
      depreciationCorrection: correction,
    };
  }
  const disposal = computeDisposal(asset, events, eventId);
  if (!disposal) {
    return null;
  }
  return {
    disposedCost: disposal.disposedCost,
    proceeds: disposal.proceeds,
    accumulatedDepreciation: disposal.accumulatedDepreciation,
    netBookValue: disposal.netBookValue,
    gainLoss: disposal.gainLoss,
    costReduction: 0,
    depreciationCorrection: 0,
  };
}

/** Computed values of a stored disposal */
export async function computeStoredDisposal(
  injector: Injector,
  disposal: IGetDepreciationDisposalsByIdsResult,
): Promise<DisposalComputation> {
  const { asset, disposals } = await loadAssetContext(injector, disposal.depreciation_id);
  const result = computeAssetEvent(asset, disposals.map(toDisposalInput), disposal.id);
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
  /** For a cost refund only; a missing mode is `FROM_ACTIVATION` */
  refundMode?: CostRefundMode | null;
  chargeId?: string | null;
  disposalDate: TimelessDateString;
  disposedCost: number;
  /** For a sale; a write-off and a cost refund have none */
  proceeds?: number | null;
};

/**
 * Proceeds default to 0, which is all a write-off or a cost refund may have (proceeds given for
 * either are kept, so that validation rejects them)
 */
export function resolveDisposalProceeds(candidate: Pick<DisposalCandidate, 'proceeds'>): number {
  return candidate.proceeds ?? 0;
}

/**
 * The mode to store: for a cost refund, the mode given or `FROM_ACTIVATION`; `null` for a sale or a
 * write-off (validation rejects a mode given for either)
 */
export function resolveRefundMode(
  candidate: Pick<DisposalCandidate, 'type' | 'refundMode'>,
): CostRefundMode | null {
  return candidate.type === 'COST_REFUND'
    ? (candidate.refundMode ?? DEFAULT_COST_REFUND_MODE)
    : null;
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
  | {
      errors: string[];
      result?: never;
      refundMode?: never;
      remainingCost?: never;
      remainingBookValue?: never;
    }
  | {
      errors?: never;
      result: DisposalComputation;
      /** The refund mode to store (`null` unless a cost refund) */
      refundMode: CostRefundMode | null;
      /** The asset's cost at the end of the event's year, after the event */
      remainingCost: number;
      /** The asset's net book value at the end of the event's year, after the event */
      remainingBookValue: number;
    }
> {
  const { record, localCost, asset, disposals } = context;
  const [{ ledgerLock, ownerId }, charge] = await Promise.all([
    injector.get(AdminContextProvider).getVerifiedAdminContext(),
    candidate.chargeId
      ? injector.get(ChargesProvider).getChargeByIdLoader.load(candidate.chargeId)
      : undefined,
  ]);

  const proceeds = resolveDisposalProceeds(candidate);
  const refundMode = resolveRefundMode(candidate);
  const errors = validateDisposalKind({
    type: candidate.type,
    proceeds,
    refundMode: candidate.refundMode,
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
  if (localCost == null) {
    errors.push('Set an amount on the depreciation record before disposing of it');
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
  const all: AssetDisposalInput[] = [
    ...disposals.filter(disposal => disposal.id !== candidate.id).map(toDisposalInput),
    {
      id,
      kind: candidate.type,
      refundMode,
      disposalDate: candidate.disposalDate,
      disposedCost: candidate.disposedCost,
      proceeds,
    },
  ];
  errors.push(...validateAssetDisposals(asset, all));

  if (errors.length > 0) {
    return { errors };
  }

  const result = computeAssetEvent(asset, all, id);
  if (!result) {
    return { errors: ['Unable to compute the disposal'] };
  }
  const year = calculateAssetYear(asset, all, getTimelessDateYear(candidate.disposalDate));
  return {
    result,
    refundMode,
    remainingCost: year.closingCost,
    remainingBookValue: year.netBookValue,
  };
}
