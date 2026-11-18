import { GraphQLError } from 'graphql';
import { encodeReportFile, generateReport, ValidationError } from '@accounter/shaam6111-generator';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { isOverridableTaxAdjustmentCode } from '../helpers/shaam6111-computation.helper.js';
import {
  convertLocalReportDataToShaam6111ReportData,
  getShaam6111Data,
  SHAAM_6111_FILE_NAME,
  validateShaam6111Report,
} from '../helpers/shaam6111.helper.js';
import {
  Shaam6111SettingsProvider,
  type Shaam6111HeaderSettings,
} from '../providers/shaam6111-settings.provider.js';
import type { ReportsModule } from '../types.js';

export const shaam6111Resolvers: ReportsModule.Resolvers = {
  Query: {
    shaam6111: async (_, { year, businessId: requestedBusinessId }, { injector }) => {
      // Per-business report: a requested business must be within the read scope;
      // default to the request's primary business otherwise.
      let businessId: string;
      if (requestedBusinessId) {
        // Validates the id is within the read scope (throws otherwise).
        await injector.get(ScopeProvider).getReadScope([requestedBusinessId]);
        businessId = requestedBusinessId;
      } else {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        businessId = ownerId;
      }
      const { reportData, issues, taxAdjustmentOverrides } = await getShaam6111Data(
        injector,
        businessId,
        year,
      );

      return {
        businessId,
        reportData,
        issues,
        taxAdjustmentOverrides,
      };
    },
  },
  Mutation: {
    updateShaam6111: async (
      _,
      { year, businessId: requestedBusinessId, header, taxAdjustmentOverrides },
      { injector },
    ) => {
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new GraphQLError(`Invalid year: ${year}`);
      }
      const businessId =
        requestedBusinessId ??
        (await injector.get(AdminContextProvider).getVerifiedAdminContext()).ownerId;

      let overrides: Record<string, number> | null = null;
      if (taxAdjustmentOverrides) {
        overrides = {};
        for (const { code, amount } of taxAdjustmentOverrides) {
          if (!isOverridableTaxAdjustmentCode(code)) {
            throw new GraphQLError(`Tax-adjustment line ${code} can't take a manual amount`);
          }
          overrides[code] = amount;
        }
      }

      let headerSettings: Shaam6111HeaderSettings | null = null;
      if (header) {
        // keep only the fields that are set, so unset ones fall back to earlier years
        headerSettings = Object.fromEntries(
          Object.entries(header).filter(([, value]) => value != null && value !== ''),
        ) as Shaam6111HeaderSettings;
      }

      await injector.get(Shaam6111SettingsProvider).updateSettings({
        ownerId: businessId,
        year,
        header: headerSettings,
        taxAdjustmentOverrides: overrides,
      });
      return true;
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
      const adjustedReportData = convertLocalReportDataToShaam6111ReportData(reportData);
      let reportContent: string;
      try {
        reportContent = generateReport(adjustedReportData, true);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new GraphQLError(
            'The 6111 report does not pass SHAAM validation; see the report validation issues',
            { extensions: { code: 'SHAAM6111_VALIDATION_FAILED' } },
          );
        }
        throw error;
      }
      return {
        id: `shaam6111-${reportData.header.idNumber}-${reportData.header.taxYear}-file`,
        reportContent,
        diffContent: '', // TODO: implement diff content
        fileName: SHAAM_6111_FILE_NAME,
        encodedContent: Buffer.from(encodeReportFile(reportContent)).toString('base64'),
      };
    },
    validation: ({ reportData, issues }) => validateShaam6111Report(reportData, issues),
    year: ({ reportData }) => parseInt(reportData.header.taxYear, 10),
    taxAdjustmentOverrides: ({ taxAdjustmentOverrides }) =>
      Object.entries(taxAdjustmentOverrides)
        .map(([code, amount]) => ({ code: Number(code), amount }))
        .sort((a, b) => a.code - b.code),
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
        profitLossEntryCount: reportData.header.profitLossEntryCount,
        taxAdjustmentEntryCount: reportData.header.taxAdjustmentEntryCount,
        balanceSheetEntryCount: reportData.header.balanceSheetEntryCount,
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
