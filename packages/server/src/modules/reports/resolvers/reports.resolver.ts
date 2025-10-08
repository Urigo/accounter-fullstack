import { generateUniformFormatReport } from '@accounter/shaam-uniform-format-generator';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import {
  dateToTimelessDateString,
  formatFinancialAmount,
  formatFinancialIntAmount,
  optionalDateToTimelessDateString,
} from '@shared/helpers';
import {
  accountsForUniformFormat,
  businessForUniformFormat,
  journalEntriesForUniformFormat,
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
    uniformFormat: async (_, { fromDate, toDate }, context, info) => {
      const accountsPromise = accountsForUniformFormat(context, info, fromDate, toDate).catch(
        err => {
          const message = `Failed to fetch accounts for uniform format: ${err.message}`;
          console.error(`${message}: ${err}`);
          throw new Error(message);
        },
      );
      const businessPromise = businessForUniformFormat(context, fromDate, toDate).catch(err => {
        const message = `Failed to fetch main business info for uniform format: ${err.message}`;
        console.error(`${message}: ${err}`);
        throw new Error(message);
      });
      const journalEntriesPromise = journalEntriesForUniformFormat(context, fromDate, toDate).catch(
        err => {
          const message = `Failed to fetch journal entries for uniform format: ${err.message}`;
          console.error(`${message}: ${err}`);
          throw new Error(message);
        },
      );
      const [accounts, business, journalEntries] = await Promise.all([
        accountsPromise,
        businessPromise,
        journalEntriesPromise,
      ]);

      // generate files
      const report = generateUniformFormatReport(
        {
          journalEntries,
          accounts,
          business,
          documents: [],
          inventory: [],
        },
        { fileNameBase: '', validationMode: 'collect-all' },
      );

      if (report.summary.errors && report.summary.errors.length > 0) {
        throw new Error(
          `Uniform format report generation failed with validation errors: ${report.summary.errors
            .map(err => `${err.recordType}[${err.recordIndex}].${err.field}: ${err.message}`)
            .join(', ')}`,
        );
      }

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
