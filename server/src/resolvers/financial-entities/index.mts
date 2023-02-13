import { Resolvers } from '../../__generated__/types.mjs';
import { pool } from '../../providers/db.mjs';
import {
  getAllFinancialEntities,
  getFinancialEntityByIdLoader,
} from '../../providers/financial-entities.mjs';
import { commonFinancialEntityFields } from './common.mjs';

export const financialEntitiesResolvers: Resolvers = {
  Query: {
    financialEntity: async (_, { id }) => {
      const dbFe = await getFinancialEntityByIdLoader.load(id);
      if (!dbFe) {
        throw new Error(`Financial entity ID="${id}" not found`);
      }
      return dbFe;
    },
    allFinancialEntities: async () => {
      return getAllFinancialEntities.run(undefined, pool);
    },
  },
  LtdFinancialEntity: {
    __isTypeOf: () => true,
    ...commonFinancialEntityFields,
    govermentId: DbBusiness => DbBusiness.vat_number ?? '', // TODO: lots missing. should it stay mandatory?
    name: DbBusiness => DbBusiness.hebrew_name ?? DbBusiness.name,
    address: DbBusiness => DbBusiness.address ?? DbBusiness.address_hebrew ?? '', // TODO: lots missing. should it stay mandatory?

    englishName: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email,
    website: DbBusiness => DbBusiness.website,
    phoneNumber: DbBusiness => DbBusiness.phone_number,
  },
  PersonalFinancialEntity: {
    __isTypeOf: () => false,
    ...commonFinancialEntityFields,
    name: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email ?? '', // TODO: remove alternative ''
  },
};
