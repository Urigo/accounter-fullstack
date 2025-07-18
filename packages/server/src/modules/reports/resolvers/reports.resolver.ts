import { generateUniformFormatReport } from '@accounter/shaam-uniform-format-generator';
import { AdminBusinessesProvider } from '@modules/financial-entities/providers/admin-businesses.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import {
  dateToTimelessDateString,
  formatFinancialAmount,
  formatFinancialIntAmount,
  optionalDateToTimelessDateString,
} from '@shared/helpers';
import {
  accountsFromFinancialEntities,
  businessMetadataFromAdminBusiness,
  journalEntriesFromLedgerRecords,
} from '../helpers/uniform-format.helper.js';
import type { ReportsModule } from '../types.js';
import { getVatRecords } from './get-vat-records.resolver.js';
import {
  corporateTaxRulingComplianceReport,
  corporateTaxRulingComplianceReportDifferences,
} from './reports/corporate-tax-ruling-compliance-report.js';
import {
  profitAndLossReport,
  profitAndLossReportYearMapper,
  reportCommentaryRecordMapper,
  reportCommentarySubRecordMapper,
} from './reports/profit-and-loss-report.resolver.js';
import { taxReport, taxReportYearMapper } from './reports/tax-report.js';
import { yearlyLedgerReport } from './reports/yearly-ledger-report.resolver.js';

export const reportsResolvers: ReportsModule.Resolvers = {
  Query: {
    vatReport: (_, args, context) => getVatRecords(args, context),
    profitAndLossReport,
    taxReport,
    corporateTaxRulingComplianceReport,
    yearlyLedgerReport,
    uniformFormat: async (_, { fromDate, toDate }, { injector, adminContext }) => {
      // get all ledger records
      const ledgerRecordsPromise = injector.get(LedgerProvider).getLedgerRecordsByDates({
        ownerId: adminContext.defaultAdminBusinessId,
        fromDate,
        toDate,
      });

      // get all relevant businesses
      const financialEntitiesPromise = injector
        .get(FinancialEntitiesProvider)
        .getAllFinancialEntities();

      // get admin business info
      const adminBusinessPromise = injector
        .get(AdminBusinessesProvider)
        .getAdminBusinessByIdLoader.load(adminContext.defaultAdminBusinessId);

      const [ledgerRecords, financialEntities, adminBusiness] = await Promise.all([
        ledgerRecordsPromise,
        financialEntitiesPromise,
        adminBusinessPromise,
      ]);

      if (!adminBusiness) {
        throw new Error('Admin business not found');
      }

      // generate files
      const report = generateUniformFormatReport(
        {
          journalEntries: journalEntriesFromLedgerRecords(ledgerRecords),
          accounts: accountsFromFinancialEntities(financialEntities),
          business: businessMetadataFromAdminBusiness(adminBusiness),
          documents: [],
          inventory: [],
        },
        { fileNameBase: '', validationMode: 'collect-all' },
      );

      // return files as a response
      return {
        ini: report.iniText,
        bkmvdata: report.dataText,
      };
    },
  },
  VatReportRecord: {
    documentId: raw => raw.documentId,
    chargeAccountantStatus: raw => raw.chargeAccountantStatus,
    chargeId: raw => raw.chargeId,
    amount: raw => formatFinancialAmount(raw.documentAmount, raw.currencyCode),
    business: (raw, _, { injector }) =>
      raw.businessId
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(raw.businessId)
            .then(res => res ?? null)
        : null,
    chargeDate: raw => dateToTimelessDateString(raw.chargeDate),
    documentDate: raw => optionalDateToTimelessDateString(raw.documentDate),
    documentSerial: raw => raw.documentSerial,
    image: raw => raw.documentUrl,
    localAmount: (raw, _, { adminContext: { defaultLocalCurrency } }) =>
      raw.eventLocalAmount
        ? formatFinancialAmount(raw.eventLocalAmount, defaultLocalCurrency)
        : null,
    localVatAfterDeduction: (raw, _, { adminContext: { defaultLocalCurrency } }) =>
      raw.localVatAfterDeduction
        ? formatFinancialAmount(raw.localVatAfterDeduction, defaultLocalCurrency)
        : null,
    roundedLocalVatAfterDeduction: (raw, _, { adminContext: { defaultLocalCurrency } }) =>
      raw.roundedVATToAdd
        ? formatFinancialIntAmount(raw.roundedVATToAdd, defaultLocalCurrency)
        : null,
    taxReducedLocalAmount: (raw, _, { adminContext: { defaultLocalCurrency } }) =>
      raw.localAmountBeforeVAT
        ? formatFinancialIntAmount(raw.localAmountBeforeVAT, defaultLocalCurrency)
        : null,
    taxReducedForeignAmount: raw =>
      raw.foreignAmountBeforeVAT
        ? formatFinancialIntAmount(raw.foreignAmountBeforeVAT, raw.currencyCode)
        : null,
    localVat: (raw, _, { adminContext: { defaultLocalCurrency } }) =>
      raw.localVat ? formatFinancialAmount(raw.localVat, defaultLocalCurrency) : null,
    foreignVat: raw =>
      raw.foreignVat ? formatFinancialAmount(raw.foreignVat, raw.currencyCode) : null,
    foreignVatAfterDeduction: raw =>
      raw.foreignVatAfterDeduction
        ? formatFinancialAmount(raw.foreignVatAfterDeduction, raw.currencyCode)
        : null,
    vatNumber: (raw, _, { injector }) =>
      raw.businessId
        ? injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(raw.businessId)
            .then(entity => entity?.vat_number ?? null)
        : null,
  },
  CorporateTaxRulingComplianceReport: {
    id: report => report.id,
    year: report => report.year,
    totalIncome: report => report.totalIncome,
    businessTripRndExpenses: report => report.businessTripRndExpenses,
    foreignDevelopmentExpenses: report => report.foreignDevelopmentExpenses,
    foreignDevelopmentRelativeToRnd: report => report.foreignDevelopmentRelativeToRnd,
    localDevelopmentExpenses: report => report.localDevelopmentExpenses,
    localDevelopmentRelativeToRnd: report => report.localDevelopmentRelativeToRnd,
    researchAndDevelopmentExpenses: report => report.researchAndDevelopmentExpenses,
    rndRelativeToIncome: report => report.rndRelativeToIncome,
    differences: corporateTaxRulingComplianceReportDifferences,
  },
  ProfitAndLossReportYear: profitAndLossReportYearMapper,
  TaxReportYear: taxReportYearMapper,
  ReportCommentaryRecord: reportCommentaryRecordMapper,
  ReportCommentarySubRecord: reportCommentarySubRecordMapper,
};
