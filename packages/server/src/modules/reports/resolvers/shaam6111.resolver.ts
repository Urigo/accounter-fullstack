import { GraphQLError } from 'graphql';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { getShaam6111Data } from '../helpers/shaam6111.helper.js';
import type { ReportsModule } from '../types.js';

export const shaam6111Resolvers: ReportsModule.Resolvers = {
  Query: {
    shaam6111: async (_, { year, businessId: requestedBusinessId }, context) => {
      const businessId = requestedBusinessId ?? context.adminContext.defaultAdminBusinessId;
      const reportData = await getShaam6111Data(context, businessId, year);

      return {
        businessId,
        reportData,
      };
    },
  },
  Shaam6111Report: {
    id: ({ reportData }) => {
      return `shaam6111-${reportData.header.idNumber}-${reportData.header.taxYear}`;
    },
    business: ({ businessId }, _, context) => {
      return context.injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(businessId)
        .then(business => {
          if (!business) {
            throw new GraphQLError(`Report business not found (ID: ${businessId})`);
          }
          return business;
        });
    },
    data: ({ reportData }) => reportData,
    file: ({ reportData }) => {
      return {
        id: `shaam6111-${reportData.header.idNumber}-${reportData.header.taxYear}-file`,
        reportContent: '', // TODO: generate report content based on reportData
        diffContent: '', // TODO: implement diff content
        fileName: `shaam6111-${reportData.header.idNumber}-${reportData.header.taxYear}-file`, // TODO: check if specific file name format is required
      };
    },
    year: ({ reportData }) => parseInt(reportData.header.taxYear, 10),
  },
  Shaam6111Data: {
    id: reportData => `shaam6111-${reportData.header.idNumber}-${reportData.header.taxYear}-file`,
    header: reportData => {
      return {
        taxFileNumber: reportData.header.taxFileNumber,
        taxYear: reportData.header.taxYear,
        idNumber: reportData.header.idNumber,
        vatFileNumber: reportData.header.vatFileNumber,
        withholdingTaxFileNumber: reportData.header.withholdingTaxFileNumber,
        industryCode: reportData.header.industryCode,
        businessDescription: reportData.header.businessDescription,
        businessType: reportData.header.businessType,
        reportingMethod: reportData.header.reportingMethod,
        accountingMethod: reportData.header.accountingMethod,
        accountingSystem: reportData.header.accountingSystem,
        isPartnership: reportData.header.isPartnership,
        includesProfitLoss: reportData.header.includesProfitLoss,
        includesTaxAdjustment: reportData.header.includesTaxAdjustment,
        includesBalanceSheet: reportData.header.includesBalanceSheet,
        profitLossEntryCount: reportData.profitAndLoss.length,
        taxAdjustmentEntryCount: reportData.taxAdjustment.length,
        balanceSheetEntryCount: reportData.balanceSheet?.length ?? 0,
        ifrsImplementationYear: reportData.header.ifrsImplementationYear,
        ifrsReportingOption: reportData.header.ifrsReportingOption,
        softwareRegistrationNumber: reportData.header.softwareRegistrationNumber,
        partnershipCount: reportData.header.partnershipCount,
        partnershipProfitShare: reportData.header.partnershipProfitShare,
        currencyType: reportData.header.currencyType,
        auditOpinionType: reportData.header.auditOpinionType,
        amountsInThousands: reportData.header.amountsInThousands,
      };
    },
    profitAndLoss: reportData => reportData.profitAndLoss,
    taxAdjustment: reportData => reportData.taxAdjustment,
    balanceSheet: reportData => reportData.balanceSheet ?? null,
    individualOrCompany: reportData => reportData.individualOrCompany ?? null,
  },
};
