import { format } from 'date-fns';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { Currency } from '@shared/enums';
import { formatFinancialAmount, formatFinancialIntAmount } from '@shared/helpers';
import type { TimelessDateString } from '@shared/types';
import { generatePcnFromCharges } from '../helpers/pcn.helper.js';
import { RawVatReportRecord } from '../helpers/vat-report.helper.js';
import type { ReportsModule } from '../types.js';
import { getVatRecords } from './get-vat-records.resolver.js';

export const reportsResolvers: ReportsModule.Resolvers = {
  Query: {
    vatReport: getVatRecords,
    pcnFile: async (_, { fromDate, toDate, financialEntityId }, context, __) => {
      const financialEntity = await context.injector
        .get(BusinessesProvider)
        .getFinancialEntityByIdLoader.load(financialEntityId);
      if (!financialEntity?.vat_number) {
        throw new Error(`Financial entity ${financialEntityId} has no VAT number`);
      }
      const vatRecords = await getVatRecords(
        _,
        { filters: { fromDate, toDate, financialEntityId } },
        context,
        __,
      );
      const reportMonth = format(new Date(fromDate), 'yyyyMM');
      return generatePcnFromCharges(
        [
          ...(vatRecords.income as RawVatReportRecord[]),
          ...(vatRecords.expenses as RawVatReportRecord[]),
        ],
        financialEntity.vat_number,
        reportMonth,
      );
    },
  },
  VatReportRecord: {
    documentId: raw => raw.documentId,
    chargeAccountantReviewed: raw => raw.chargeAccountantReviewed,
    chargeId: raw => raw.chargeId,
    amount: raw => formatFinancialAmount(raw.documentAmount, raw.currencyCode),
    business: raw => raw.businessId,
    chargeDate: raw => format(raw.chargeDate, 'yyyy-MM-dd') as TimelessDateString,
    documentDate: raw =>
      raw.documentDate ? (format(raw.documentDate, 'yyyy-MM-dd') as TimelessDateString) : null,
    documentSerial: raw => raw.documentSerial,
    image: raw => raw.documentUrl,
    localAmount: raw =>
      raw.eventAmountILS ? formatFinancialAmount(raw.eventAmountILS, Currency.Ils) : null,
    localVatAfterDeduction: raw =>
      raw.vatAfterDeductionILS
        ? formatFinancialAmount(raw.vatAfterDeductionILS, Currency.Ils)
        : null,
    roundedLocalVatAfterDeduction: raw =>
      raw.roundedVATToAdd ? formatFinancialIntAmount(raw.roundedVATToAdd, Currency.Ils) : null,
    taxReducedLocalAmount: raw =>
      raw.amountBeforeVAT ? formatFinancialIntAmount(raw.amountBeforeVAT, Currency.Ils) : null,
    vat: raw => (raw.vat ? formatFinancialAmount(raw.vat, Currency.Ils) : null),
    vatAfterDeduction: raw =>
      raw.vatAfterDeduction ? formatFinancialAmount(raw.vatAfterDeduction, Currency.Ils) : null,
    vatNumber: (raw, _, { injector }) =>
      raw.businessId
        ? injector
            .get(BusinessesProvider)
            .getFinancialEntityByIdLoader.load(raw.businessId)
            .then(entity => entity?.vat_number ?? null)
        : null,
  },
};
