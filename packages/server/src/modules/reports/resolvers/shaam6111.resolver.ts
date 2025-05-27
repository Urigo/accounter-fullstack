import { GraphQLError } from 'graphql';
import { IndividualOrCompanyEnum } from '@accounter/shaam6111-generator';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import {
  accountingMethodSafeParser,
  accountingSystemSafeParser,
  auditOpinionTypeSafeParser,
  businessTypeSafeParser,
  currencyTypeSafeParser,
  getShaam6111Data,
  ifrsReportingOptionSafeParser,
  reportingMethodSafeParser,
  yesNoToBoolean,
  yesNoToOptionalBoolean,
} from '../helpers/shaam6111.helper.js';
import type { ReportsModule } from '../types.js';

export const shaam6111Resolvers: ReportsModule.Resolvers = {
  Query: {
    shaam6111: async (_, { year, businessId }, context) => {
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
        businessType: businessTypeSafeParser(reportData.header.businessType),
        reportingMethod: reportingMethodSafeParser(reportData.header.reportingMethod),
        accountingMethod: accountingMethodSafeParser(reportData.header.accountingMethod),
        accountingSystem: accountingSystemSafeParser(reportData.header.accountingSystem),
        isPartnership: yesNoToOptionalBoolean(reportData.header.isPartnership),
        includesProfitLoss: yesNoToBoolean(reportData.header.includesProfitLoss),
        includesTaxAdjustment: yesNoToBoolean(reportData.header.includesTaxAdjustment),
        includesBalanceSheet: yesNoToBoolean(reportData.header.includesBalanceSheet),
        profitLossEntryCount: reportData.profitAndLoss.length,
        taxAdjustmentEntryCount: reportData.taxAdjustment.length,
        balanceSheetEntryCount: reportData.balanceSheet?.length ?? 0,
        ifrsImplementationYear: reportData.header.ifrsImplementationYear,
        ifrsReportingOption: ifrsReportingOptionSafeParser(reportData.header.ifrsReportingOption),
        softwareRegistrationNumber: reportData.header.softwareRegistrationNumber,
        partnershipCount: reportData.header.partnershipCount,
        partnershipProfitShare: reportData.header.partnershipProfitShare,
        currencyType: currencyTypeSafeParser(reportData.header.currencyType),
        auditOpinionType: auditOpinionTypeSafeParser(reportData.header.auditOpinionType),
        amountsInThousands: yesNoToBoolean(reportData.header.amountsInThousands),
      };
    },
    profitAndLoss: reportData => reportData.profitAndLoss,
    taxAdjustment: reportData => reportData.taxAdjustment,
    balanceSheet: reportData => reportData.balanceSheet,
    individualOrCompany: reportData => {
      switch (reportData.individualOrCompany) {
        case IndividualOrCompanyEnum.INDIVIDUAL:
          return 'INDIVIDUAL';
        case IndividualOrCompanyEnum.COMPANY:
          return 'COMPANY';
        default:
          throw new GraphQLError(
            `Invalid individual or company type: ${reportData.individualOrCompany}`,
          );
      }
    },
  },
};
