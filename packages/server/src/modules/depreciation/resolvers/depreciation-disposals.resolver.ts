import { GraphQLError } from 'graphql';
import type { Resolvers } from '../../../__generated__/types.js';
import { formatFinancialAmount } from '../../../shared/helpers/index.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { remainingAssetCost } from '../helpers/asset-depreciation.helper.js';
import {
  checkDisposal,
  computeStoredDisposal,
  isDisposalDateLocked,
  loadAssetContext,
  storedProceeds,
  storedRefundMode,
  toDisposalInput,
} from '../helpers/depreciation-disposals.helper.js';
import { DepreciationDisposalsProvider } from '../providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../providers/depreciation.provider.js';
import type { DepreciationModule } from '../types.js';

function commonError(message: string) {
  return { __typename: 'CommonError' as const, message };
}

async function localAmount(injector: GraphQLModules.Context['injector'], amount: number | string) {
  const { defaultLocalCurrency } = await injector
    .get(AdminContextProvider)
    .getVerifiedAdminContext();
  return formatFinancialAmount(amount, defaultLocalCurrency);
}

export const depreciationDisposalsResolvers: DepreciationModule.Resolvers &
  Pick<
    Resolvers,
    | 'InsertDepreciationDisposalResult'
    | 'UpdateDepreciationDisposalResult'
    | 'PreviewDepreciationDisposalResult'
  > = {
  Query: {
    depreciationRecords: async (_, { activeOn }, { injector }) => {
      const records = await injector
        .get(DepreciationProvider)
        .getDepreciationRecordsActivatedBy({ date: activeOn });
      const disposalsPerRecord = await injector
        .get(DepreciationDisposalsProvider)
        .getDisposalsByDepreciationIdLoader.loadMany(records.map(record => record.id));
      return records.filter((record, index) => {
        const disposals = disposalsPerRecord[index];
        if (disposals instanceof Error) {
          throw disposals;
        }
        const disposedBefore = disposals
          .filter(disposal => disposal.disposal_date <= activeOn)
          .map(toDisposalInput);
        // a record without an amount can't be disposed of, so it isn't offered
        return (
          record.amount != null &&
          remainingAssetCost({ cost: Number(record.amount) }, disposedBefore) > 0
        );
      });
    },
    previewDepreciationDisposal: async (_, { input }, { injector }) => {
      try {
        const context = await loadAssetContext(injector, input.depreciationRecordId);
        const check = await checkDisposal(injector, context, input);
        if (check.errors) {
          return commonError(check.errors.join('; '));
        }
        const { result, remainingCost, remainingBookValue } = check;
        const [
          disposedCost,
          proceeds,
          accumulatedDepreciation,
          netBookValue,
          gainLoss,
          costReduction,
          depreciationCorrection,
          remainingCostAmount,
          remainingBookValueAmount,
        ] = await Promise.all(
          [
            result.disposedCost,
            result.proceeds,
            result.accumulatedDepreciation,
            result.netBookValue,
            result.gainLoss,
            result.costReduction,
            result.depreciationCorrection,
            remainingCost,
            remainingBookValue,
          ].map(amount => localAmount(injector, amount)),
        );
        return {
          __typename: 'DepreciationDisposalComputation',
          disposedCost,
          proceeds,
          accumulatedDepreciation,
          netBookValue,
          gainLoss,
          costReduction,
          depreciationCorrection,
          remainingCost: remainingCostAmount,
          remainingBookValue: remainingBookValueAmount,
        };
      } catch (e) {
        console.error(e);
        return commonError(
          e instanceof GraphQLError ? e.message : 'Error previewing depreciation disposal',
        );
      }
    },
  },
  Mutation: {
    insertDepreciationDisposal: async (_, { input }, { injector }) => {
      try {
        const context = await loadAssetContext(injector, input.depreciationRecordId);
        const check = await checkDisposal(injector, context, input);
        if (check.errors) {
          return commonError(check.errors.join('; '));
        }
        const [inserted] = await injector.get(DepreciationDisposalsProvider).insertDisposal({
          depreciationId: input.depreciationRecordId,
          chargeId: input.chargeId ?? null,
          type: input.type,
          refundMode: check.refundMode,
          disposalDate: input.disposalDate,
          disposedCost: input.disposedCost,
          proceeds: check.result.proceeds,
          description: input.description ?? null,
        });
        if (!inserted) {
          return commonError('Error inserting depreciation disposal');
        }
        await degradeChargesAccountantApproval(injector, [inserted.charge_id]);
        return inserted;
      } catch (e) {
        console.error(e);
        return commonError(
          e instanceof GraphQLError ? e.message : 'Error inserting depreciation disposal',
        );
      }
    },
    updateDepreciationDisposal: async (_, { input }, { injector }) => {
      try {
        const provider = injector.get(DepreciationDisposalsProvider);
        const existing = await provider.getDisposalByIdLoader.load(input.id);
        if (!existing) {
          return commonError(`Depreciation disposal with id ${input.id} not found`);
        }
        const clearChargeId = input.chargeId === null;
        const chargeId = clearChargeId ? null : (input.chargeId ?? existing.charge_id);
        const type = input.type ?? existing.type;
        const disposedCost = input.disposedCost ?? Number(existing.disposed_cost);
        // a refund keeps its mode unless one is given (a mode given for another type is rejected)
        const refundMode =
          input.refundMode === undefined
            ? type === 'COST_REFUND'
              ? storedRefundMode(existing)
              : null
            : input.refundMode;

        const context = await loadAssetContext(injector, existing.depreciation_id);
        const check = await checkDisposal(injector, context, {
          id: existing.id,
          type,
          refundMode,
          chargeId,
          disposalDate: input.disposalDate ?? existing.disposal_date,
          disposedCost,
          proceeds:
            input.proceeds ??
            // a sale keeps its stored proceeds; a write-off and a cost refund have none
            (type === 'SALE' ? storedProceeds(existing) : null),
        });
        if (check.errors) {
          return commonError(check.errors.join('; '));
        }

        const [updated] = await provider.updateDisposal({
          id: existing.id,
          chargeId: clearChargeId ? null : (input.chargeId ?? null),
          clearChargeId,
          type: input.type ?? null,
          refundMode: check.refundMode,
          disposalDate: input.disposalDate ?? null,
          disposedCost: input.disposedCost ?? null,
          proceeds: check.result.proceeds,
          // null clears the description; leaving it out keeps the stored one
          description: input.description === undefined ? existing.description : input.description,
        });
        if (!updated) {
          return commonError('Error updating depreciation disposal');
        }
        await degradeChargesAccountantApproval(injector, [existing.charge_id, updated.charge_id]);
        return updated;
      } catch (e) {
        console.error(e);
        return commonError(
          e instanceof GraphQLError ? e.message : 'Error updating depreciation disposal',
        );
      }
    },
    deleteDepreciationDisposal: async (_, { id }, { injector }) => {
      const provider = injector.get(DepreciationDisposalsProvider);
      const [existing, { ledgerLock }] = await Promise.all([
        provider.getDisposalByIdLoader.load(id),
        injector.get(AdminContextProvider).getVerifiedAdminContext(),
      ]);
      if (!existing) {
        return false;
      }
      if (isDisposalDateLocked(existing.disposal_date, ledgerLock)) {
        throw new GraphQLError(
          `The disposal is dated ${existing.disposal_date}, in the locked period (${ledgerLock}), and can't be deleted`,
        );
      }
      const [deleted] = await provider.deleteDisposal({ id });
      if (!deleted) {
        return false;
      }
      await degradeChargesAccountantApproval(injector, [deleted.charge_id]);
      return true;
    },
  },
  InsertDepreciationDisposalResult: {
    __resolveType: obj => ('message' in obj ? 'CommonError' : 'DepreciationDisposal'),
  },
  UpdateDepreciationDisposalResult: {
    __resolveType: obj => ('message' in obj ? 'CommonError' : 'DepreciationDisposal'),
  },
  PreviewDepreciationDisposalResult: {
    __resolveType: obj => ('message' in obj ? 'CommonError' : 'DepreciationDisposalComputation'),
  },
  DepreciationRecord: {
    disposals: (record, _, { injector }) =>
      injector
        .get(DepreciationDisposalsProvider)
        .getDisposalsByDepreciationIdLoader.load(record.id),
    remainingCost: async (record, _, { injector }) => {
      const disposals = await injector
        .get(DepreciationDisposalsProvider)
        .getDisposalsByDepreciationIdLoader.load(record.id);
      const remaining = remainingAssetCost(
        { cost: Number(record.amount ?? 0) },
        disposals.map(toDisposalInput),
      );
      return record.currency
        ? formatFinancialAmount(remaining, record.currency)
        : localAmount(injector, remaining);
    },
  },
  CommonCharge: {
    depreciationDisposals: (charge, _, { injector }) =>
      injector.get(DepreciationDisposalsProvider).getDisposalsByChargeIdLoader.load(charge.id),
  },
  ChargeMetadata: {
    depreciationDisposalsCount: (charge, _, { injector }) =>
      injector
        .get(DepreciationDisposalsProvider)
        .getDisposalsByChargeIdLoader.load(charge.id)
        .then(disposals => disposals.length),
  },
  DepreciationDisposal: {
    id: disposal => disposal.id,
    depreciationRecord: async (disposal, _, { injector }) => {
      const record = await injector
        .get(DepreciationProvider)
        .getDepreciationRecordByIdLoader.load(disposal.depreciation_id);
      if (!record) {
        throw new GraphQLError(`Depreciation record with id ${disposal.depreciation_id} not found`);
      }
      return record;
    },
    charge: async (disposal, _, { injector }) => {
      if (!disposal.charge_id) {
        return null;
      }
      const charge = await injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(disposal.charge_id);
      if (!charge) {
        throw new GraphQLError(`Charge with id ${disposal.charge_id} not found`);
      }
      return charge;
    },
    type: disposal => disposal.type,
    refundMode: disposal => storedRefundMode(disposal),
    disposalDate: disposal => disposal.disposal_date,
    disposedCost: (disposal, _, { injector }) => localAmount(injector, disposal.disposed_cost),
    proceeds: (disposal, _, { injector }) => localAmount(injector, storedProceeds(disposal)),
    description: disposal => disposal.description,
    accumulatedDepreciation: async (disposal, _, { injector }) =>
      localAmount(
        injector,
        (await computeStoredDisposal(injector, disposal)).accumulatedDepreciation,
      ),
    netBookValue: async (disposal, _, { injector }) =>
      localAmount(injector, (await computeStoredDisposal(injector, disposal)).netBookValue),
    gainLoss: async (disposal, _, { injector }) =>
      localAmount(injector, (await computeStoredDisposal(injector, disposal)).gainLoss),
    costReduction: async (disposal, _, { injector }) =>
      localAmount(injector, (await computeStoredDisposal(injector, disposal)).costReduction),
    depreciationCorrection: async (disposal, _, { injector }) =>
      localAmount(
        injector,
        (await computeStoredDisposal(injector, disposal)).depreciationCorrection,
      ),
  },
};
