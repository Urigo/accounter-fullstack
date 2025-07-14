import { GraphQLError } from 'graphql';
import { AdminBusinessesProvider } from '../providers/admin-businesses.provider.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

export const adminBusinessesResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    adminBusiness: async (_, { id }, { injector }) => {
      const adminBusiness = await injector
        .get(AdminBusinessesProvider)
        .getAdminBusinessByIdLoader.load(id);
      if (!adminBusiness) {
        throw new GraphQLError(`Admin business ID="${id}" not found`);
      }

      return adminBusiness;
    },
    allAdminBusinesses: async (_, __, { injector }) => {
      const adminBusinesses = await injector.get(AdminBusinessesProvider).getAllAdminBusinesses();

      return adminBusinesses;
    },
  },
  AdminBusiness: {
    id: admin => admin.id,
    name: admin => admin.name,
    governmentId: admin => {
      if (!admin.vat_number) {
        throw new GraphQLError(`Admin business ID="${admin.id}" has no VAT number`);
      }
      return admin.vat_number;
    },
    business: async (admin, _, { injector }) => {
      const business = await injector.get(BusinessesProvider).getBusinessByIdLoader.load(admin.id);
      if (!business) {
        throw new GraphQLError(`Business ID="${admin.id}" not found`);
      }
      return business;
    },
  },
};
