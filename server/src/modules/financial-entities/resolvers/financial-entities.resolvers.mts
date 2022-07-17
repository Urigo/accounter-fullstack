import { FinancialEntitiesModule } from "../generated-types/graphql";
import { FinancialEntitiesProvider } from "../providers/financial-entities.provider.mjs";

const commonFinancialEntityFields: FinancialEntitiesModule.LtdFinancialEntityResolvers | FinancialEntitiesModule.PersonalFinancialEntityResolvers = {
    id: DbBusiness => DbBusiness.id,
    // accounts: async DbBusiness => {
    //   // TODO: add functionality for linkedEntities data
    //   const accounts = await getFinancialAccountsByFinancialEntityIdLoader.load(DbBusiness.id);
    //   return accounts;
    // },
    // charges: async (DbBusiness, { filter }) => {
    //   if (!filter || Object.keys(filter).length === 0) {
    //     const charges = await getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
    //     return charges;
    //   }
    //   const charges = await getChargesByFinancialEntityIds.run(
    //     {
    //       financialEntityIds: [DbBusiness.id],
    //       fromDate: filter?.fromDate,
    //       toDate: filter?.toDate,
    //     },
    //     pool
    //   );
    //   return charges;
    // },
    linkedEntities: () => [], // TODO: implement
    // documents: async DbBusiness => {
    //   const documents = await getDocumentsByFinancialEntityIds.run({ financialEntityIds: [DbBusiness.id] }, pool);
    //   return documents;
    // },
  };

  export const resolvers: FinancialEntitiesModule.Resolvers = {
    Query: {
        financialEntity: async (_, { id }, {injector}) => {
            const dbFe = await injector.get(FinancialEntitiesProvider).getFinancialEntityByIdLoader.load(id);
            if (!dbFe) {
              throw new Error(`Financial entity ID="${id}" not found`);
            }
            return dbFe;
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
  }