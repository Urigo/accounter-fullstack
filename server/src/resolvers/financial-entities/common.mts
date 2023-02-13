import type { IGetChargesByIdsResult } from '../../__generated__/charges.types.mjs';
import {
  LtdFinancialEntityResolvers,
  PersonalFinancialEntityResolvers,
} from '../../__generated__/types.mjs';
import {
  getChargeByFinancialEntityIdLoader,
  getChargesByFinancialEntityIds,
} from '../../providers/charges.mjs';
import { pool } from '../../providers/db.mjs';
import { getDocumentsByFinancialEntityIds } from '../../providers/documents.mjs';
import { getFinancialAccountsByFinancialEntityIdLoader } from '../../providers/financial-accounts.mjs';

export const commonFinancialEntityFields:
  | LtdFinancialEntityResolvers
  | PersonalFinancialEntityResolvers = {
  id: DbBusiness => DbBusiness.id,
  accounts: async DbBusiness => {
    // TODO: add functionality for linkedEntities data
    const accounts = await getFinancialAccountsByFinancialEntityIdLoader.load(DbBusiness.id);
    return accounts;
  },
  charges: async (DbBusiness, { filter, page, limit }) => {
    const charges: IGetChargesByIdsResult[] = [];
    if (!filter || Object.keys(filter).length === 0) {
      const newCharges = await getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
      charges.push(...newCharges);
    } else {
      const newCharges = await getChargesByFinancialEntityIds.run(
        {
          financialEntityIds: [DbBusiness.id],
          fromDate: filter?.fromDate,
          toDate: filter?.toDate,
        },
        pool,
      );
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
  linkedEntities: () => [], // TODO: implement
  documents: async DbBusiness => {
    const documents = await getDocumentsByFinancialEntityIds.run(
      { financialEntityIds: [DbBusiness.id] },
      pool,
    );
    return documents;
  },
};
