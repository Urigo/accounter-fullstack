import { ChargeRequiredWrapper, ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule, IGetChargesByIdsResult } from '../types.js';

export const commonDocumentsFields: ChargesModule.DocumentResolvers = {
  charge: async (documentRoot, _, { injector }) => {
    if (!documentRoot.charge_id_new) {
      return null;
    }
    const charge = await injector
      .get(ChargesProvider)
      .getChargeByIdLoader.load(documentRoot.charge_id_new);
    return charge ?? null;
  },
};

export const commonFinancialAccountFields:
  | ChargesModule.CardFinancialAccountResolvers
  | ChargesModule.BankFinancialAccountResolvers = {
  charges: async (DbAccount, { filter }, { injector }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await injector
        .get(ChargesProvider)
        .getChargeByFinancialAccountIDsLoader.load(DbAccount.id);
      return charges;
    }
    const charges = await injector.get(ChargesProvider).getChargesByFinancialAccountIds({
      financialAccountIDs: [DbAccount.id],
      fromDate: filter?.fromDate,
      toDate: filter?.toDate,
    });
    return charges;
  },
};

export const commonFinancialEntityFields:
  | ChargesModule.LtdFinancialEntityResolvers
  | ChargesModule.PersonalFinancialEntityResolvers = {
  charges: async (DbBusiness, { filter, page, limit }, { injector }) => {
    const charges: ChargeRequiredWrapper<IGetChargesByIdsResult>[] = [];
    if (!filter || Object.keys(filter).length === 0) {
      const newCharges = await injector
        .get(ChargesProvider)
        .getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
      charges.push(...newCharges);
    } else {
      const newCharges = await injector.get(ChargesProvider).getChargesByFinancialEntityIds({
        ownerIds: [DbBusiness.id],
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
      });
      charges.push(...newCharges);
    }
    return {
      __typename: 'PaginatedCharges',
      nodes: charges.slice(page * limit - limit, page * limit),
      pageInfo: {
        totalPages: Math.ceil(charges.length / limit),
      },
    };
  },
};
