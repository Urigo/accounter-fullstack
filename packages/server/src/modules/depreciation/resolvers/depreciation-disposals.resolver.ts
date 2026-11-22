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
  loadAssetContext,
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
        return (
          record.amount == null ||
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
        const { result, remainingCost } = check;
        const [disposedCost, proceeds, accumulatedDepreciation, netBookValue, gainLoss, remaining] =
          await Promise.all([
            localAmount(injector, result.disposedCost),
            localAmount(injector, result.proceeds),
            localAmount(injector, result.accumulatedDepreciation),
            localAmount(injector, result.netBookValue),
            localAmount(injector, result.gainLoss),
            localAmount(injector, remainingCost),
          ]);
        return {
          __typename: 'DepreciationDisposalComputation',
          disposedCost,
          proceeds,
          accumulatedDepreciation,
          netBookValue,
          gainLoss,
          remainingCost: remaining,
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

        const context = await loadAssetContext(injector, existing.depreciation_id);
        const check = await checkDisposal(injector, context, {
          id: existing.id,
          type,
          chargeId,
          disposalDate: input.disposalDate ?? existing.disposal_date,
          disposedCost,
          proceeds:
            input.proceeds ??
            // a refund's proceeds follow its cost; otherwise keep what was stored
            (type === 'COST_REFUND' ? disposedCost : Number(existing.proceeds)),
        });
        if (check.errors) {
          return commonError(check.errors.join('; '));
        }

        const [updated] = await provider.updateDisposal({
          id: existing.id,
          chargeId: clearChargeId ? null : (input.chargeId ?? null),
          clearChargeId,
          type: input.type ?? null,
          disposalDate: input.disposalDate ?? null,
          disposedCost: input.disposedCost ?? null,
          proceeds: check.result.proceeds,
          description: input.description ?? null,
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
      const [deleted] = await injector.get(DepreciationDisposalsProvider).deleteDisposal({ id });
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
      return localAmount(
        injector,
        remainingAssetCost({ cost: Number(record.amount ?? 0) }, disposals.map(toDisposalInput)),
      );
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
    disposalDate: disposal => disposal.disposal_date,
    disposedCost: (disposal, _, { injector }) => localAmount(injector, disposal.disposed_cost),
    proceeds: (disposal, _, { injector }) => localAmount(injector, disposal.proceeds),
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
  },
};
