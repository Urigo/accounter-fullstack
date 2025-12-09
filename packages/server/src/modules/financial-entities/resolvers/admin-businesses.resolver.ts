import { GraphQLError } from 'graphql';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '../../../shared/types/index.js';
import { taxAdvancesRatesSchema, yearlyIdsSchema } from '../helpers/admin-businesses.helper.js';
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
  Mutation: {
    updateAdminBusiness: async (_, { businessId, fields }, { injector }) => {
      try {
        await injector.get(AdminBusinessesProvider).updateAdminBusiness({
          id: businessId,
          businessRegistrationStartDate: fields.registrationDate,
          companyTaxId: fields.withholdingTaxCompanyId,
          taxAdvancesIds: fields.taxAdvancesAnnualIds
            ? [...fields.taxAdvancesAnnualIds]
            : undefined,
          advanceTaxRates: fields.taxAdvancesRates ? [...fields.taxAdvancesRates] : undefined,
          withholdingTaxAnnualIds: fields.withholdingTaxAnnualIds
            ? [...fields.withholdingTaxAnnualIds]
            : undefined,
          socialSecurityEmployerIds: fields.socialSecurityEmployerIds
            ? [...fields.socialSecurityEmployerIds]
            : undefined,
        });

        const updatedAdminBusiness = await injector
          .get(AdminBusinessesProvider)
          .getAdminBusinessByIdLoader.load(businessId);

        if (!updatedAdminBusiness) {
          throw new GraphQLError(`Error updating Admin business ID="${businessId}"`);
        }

        return updatedAdminBusiness;
      } catch (error) {
        const message = `Error updating Admin business ID="${businessId}"`;
        console.error(message, error);
        throw new GraphQLError(message);
      }
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
    registrationDate: admin => {
      if (!admin.registration_date) {
        throw new GraphQLError(`Admin business ID="${admin.id}" has no registration date`);
      }
      return dateToTimelessDateString(admin.registration_date);
    },
    business: async (admin, _, { injector }) => {
      const business = await injector.get(BusinessesProvider).getBusinessByIdLoader.load(admin.id);
      if (!business) {
        throw new GraphQLError(`Business ID="${admin.id}" not found`);
      }
      return business;
    },
    taxAdvancesAnnualIds: admin => yearlyIdsSchema.parse(admin.tax_advances_ids),
    taxAdvancesRates: admin =>
      taxAdvancesRatesSchema.parse(admin.advance_tax_rates) as Array<{
        date: TimelessDateString;
        rate: number;
      }>,
    withholdingTaxCompanyId: admin => admin.company_tax_id,
    withholdingTaxAnnualIds: admin => yearlyIdsSchema.parse(admin.withholding_tax_annual_ids),
    socialSecurityDeductionsId: admin => `${admin.company_tax_id}00`,
    socialSecurityEmployerIds: admin => yearlyIdsSchema.parse(admin.social_security_employer_ids),
  },
  LtdFinancialEntity: {
    adminInfo: async (parentBusiness, _, { injector }) => {
      const adminBusiness = await injector
        .get(AdminBusinessesProvider)
        .getAdminBusinessByIdLoader.load(parentBusiness.id);

      return adminBusiness ?? null;
    },
  },
};
