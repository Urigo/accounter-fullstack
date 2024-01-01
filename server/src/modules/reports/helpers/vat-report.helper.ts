import { GraphQLError } from 'graphql';
import type { IGetChargesByFiltersResult } from '@modules/charges/types';
import type { IGetDocumentsByFiltersResult } from '@modules/documents/types';
import {
  getClosestRateForDate,
  getRateForCurrency,
} from '@modules/exchange-rates/helpers/exchange.helper.js';
import type { IGetExchangeRatesByDatesResult } from '@modules/exchange-rates/types';
import type { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types';
import { TAX_CATEGORIES_WITH_NOT_FULL_VAT } from '@shared/constants';
import { DocumentType } from '@shared/enums';

export type VatReportRecordSources = {
  charge: IGetChargesByFiltersResult;
  doc: IGetDocumentsByFiltersResult;
  business: IGetFinancialEntitiesByIdsResult;
};

export type RawVatReportRecord = {
  amountBeforeVAT?: number;
  businessId: string | null;
  chargeDate: Date;
  chargeId: string;
  currencyCode: string;
  documentAmount: string;
  documentId: string;
  documentDate: Date | null;
  documentSerial: string | null;
  documentUrl: string | null;
  eventAmountILS?: number;
  isExpense: boolean;
  isProperty: boolean;
  roundedVATToAdd?: number;
  vat: number | null;
  vatAfterDeduction?: number;
  vatAfterDeductionILS?: number;
  vatNumber?: string | null;
};

export function adjustTaxRecords(
  rawRecords: Array<VatReportRecordSources>,
  exchangeRatesList: Array<IGetExchangeRatesByDatesResult>,
): RawVatReportRecord[] {
  const records: RawVatReportRecord[] = [];

  for (const rawRecord of rawRecords) {
    const { charge, doc, business } = rawRecord;

    if (!doc.total_amount) {
      throw new Error(`Amount missing for invoice ID=${doc.id}`);
    }

    if (!doc.currency_code) {
      throw new Error(`Currency missing for invoice ID=${doc.id}`);
    }
    if (!doc.date) {
      throw new Error(`Date is missing for invoice ID=${doc.id}`);
    }

    // get exchange rate
    const exchangeRates = getClosestRateForDate(doc.date, exchangeRatesList);
    const rate = getRateForCurrency(doc.currency_code, exchangeRates);

    // convert document vat to ILS
    doc.vat_amount &&= doc.vat_amount * rate;

    const partialRecord: RawVatReportRecord = {
      businessId: charge.business_id,
      chargeDate: charge.transactions_min_event_date ?? charge.documents_min_date!, // must have min_date, as will throw if local doc is missing date
      chargeId: charge.id,
      currencyCode: doc.currency_code,
      documentDate: doc.date,
      documentId: doc.id,
      documentSerial: doc.serial_number,
      documentUrl: doc.image_url,
      documentAmount: String((doc.type === DocumentType.CreditInvoice ? -1 : 1) * doc.total_amount),
      vat: doc.vat_amount,
      isProperty: charge.is_property,
      vatNumber: business.vat_number,
      isExpense:
        doc.type === DocumentType.CreditInvoice
          ? doc.debtor_id !== charge.owner_id
          : doc.debtor_id === charge.owner_id,
    };

    // set default amountBeforeVAT
    if (!partialRecord.vat) {
      partialRecord.amountBeforeVAT =
        doc.total_amount * rate * (doc.type === DocumentType.CreditInvoice ? -1 : 1);
    }

    if (partialRecord.businessId && partialRecord.vat) {
      // TODO: Add a check if there is vat and it's not equal for 17 percent, let us know
      const convertedVat = 17 / 117;
      const tiplessTotalAmount =
        doc.total_amount - (doc.no_vat_amount ? Number(doc.no_vat_amount) : 0);
      const vatDiff = Math.abs(tiplessTotalAmount * convertedVat - doc.vat_amount!);
      if (vatDiff > 0.005) {
        throw new GraphQLError(
          `VAT amount is not 17% (but ${
            doc.vat_amount! / (tiplessTotalAmount - doc.vat_amount!)
          }) for invoice ID=${doc.id}`,
        );
      }

      // decorate record with additional fields

      const isNotFullVat = TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(partialRecord.businessId);
      const vatAfterDeduction = isNotFullVat ? (partialRecord.vat / 3) * 2 : partialRecord.vat;
      const amountBeforeVAT = doc.total_amount - vatAfterDeduction;

      partialRecord.vatAfterDeduction = vatAfterDeduction;
      partialRecord.roundedVATToAdd = Math.round(vatAfterDeduction * rate);
      partialRecord.amountBeforeVAT = amountBeforeVAT * rate;
      partialRecord.eventAmountILS = doc.total_amount * rate;
      partialRecord.vatAfterDeductionILS = vatAfterDeduction * rate;
    }

    records.push(partialRecord);
  }

  return records;
}
