import { format } from 'date-fns';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { Currency } from '@shared/enums';
import {
  dateToTimelessDateString,
  formatFinancialAmount,
  formatFinancialIntAmount,
  optionalDateToTimelessDateString,
} from '@shared/helpers';
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
        .getBusinessByIdLoader.load(financialEntityId);
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
            .getBusinessByIdLoader.load(raw.businessId)
            .then(entity => entity?.vat_number ?? null)
        : null,
  },
};
