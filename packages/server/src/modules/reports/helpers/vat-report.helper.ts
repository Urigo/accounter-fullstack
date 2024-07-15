import type { IGetChargesByFiltersResult } from '@modules/charges/types';
import type { IGetDocumentsByFiltersResult } from '@modules/documents/types';
import {
  getClosestRateForDate,
  getRateForCurrency,
} from '@modules/exchange-rates/helpers/exchange.helper.js';
import type { IGetExchangeRatesByDatesResult } from '@modules/exchange-rates/types';
import type { IGetBusinessesByIdsResult } from '@modules/financial-entities/types';
import {
  DECREASED_VAT_RATIO,
  DEFAULT_LOCAL_CURRENCY,
  DEFAULT_VAT_PERCENTAGE,
} from '@shared/constants';
import { Currency, DocumentType } from '@shared/enums';
import { formatCurrency } from '@shared/helpers';

export type VatReportRecordSources = {
  charge: IGetChargesByFiltersResult;
  doc: IGetDocumentsByFiltersResult;
  business: IGetBusinessesByIdsResult;
};

export type RawVatReportRecord = {
  localAmountBeforeVAT?: number;
  foreignAmountBeforeVAT?: number;
  businessId: string | null;
  chargeAccountantReviewed: boolean;
  chargeDate: Date;
  chargeId: string;
  currencyCode: Currency;
  documentAmount: string;
  documentId: string;
  documentDate: Date | null;
  documentSerial: string | null;
  documentUrl: string | null;
  eventLocalAmount?: number;
  isExpense: boolean;
  isProperty: boolean;
  roundedVATToAdd?: number;
  foreignVat: number | null;
  localVat: number | null;
  foreignVatAfterDeduction?: number;
  localVatAfterDeduction?: number;
  vatNumber?: string | null;
};

export function adjustTaxRecords(
  rawRecords: Array<VatReportRecordSources>,
  exchangeRatesList: Array<IGetExchangeRatesByDatesResult>,
): RawVatReportRecord[] {
  const records: RawVatReportRecord[] = [];

  for (const rawRecord of rawRecords) {
    const { charge, doc, business } = rawRecord;
    const currency = formatCurrency(doc.currency_code);

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
    const rate = getRateForCurrency(currency, exchangeRates);

    const partialRecord: RawVatReportRecord = {
      businessId: charge.business_id,
      chargeAccountantReviewed: charge.accountant_reviewed,
      chargeDate: charge.transactions_min_event_date ?? charge.documents_min_date!, // must have min_date, as will throw if local doc is missing date
      chargeId: charge.id,
      currencyCode: currency,
      documentDate: doc.date,
      documentId: doc.id,
      documentSerial: doc.serial_number,
      documentUrl: doc.image_url,
      documentAmount: String((doc.type === DocumentType.CreditInvoice ? -1 : 1) * doc.total_amount),
      foreignVat: doc.currency_code === DEFAULT_LOCAL_CURRENCY ? null : doc.vat_amount,
      localVat: doc.currency_code === DEFAULT_LOCAL_CURRENCY ? doc.vat_amount : null,
      isProperty: charge.is_property,
      vatNumber: business.vat_number,
      isExpense:
        doc.type === DocumentType.CreditInvoice
          ? doc.debtor_id !== charge.owner_id
          : doc.debtor_id === charge.owner_id,
    };

    // set default amountBeforeVAT
    if (!doc.vat_amount) {
      partialRecord.localAmountBeforeVAT =
        doc.total_amount * rate * (doc.type === DocumentType.CreditInvoice ? -1 : 1);
    } else if (partialRecord.businessId) {
      // TODO: figure out how to handle VAT != DEFAULT_VAT_PERCENTAGE
      const convertedVat = DEFAULT_VAT_PERCENTAGE / (1 + DEFAULT_VAT_PERCENTAGE);
      const tiplessTotalAmount =
        doc.total_amount - (doc.no_vat_amount ? Number(doc.no_vat_amount) : 0);
      const vatDiff = Math.abs(tiplessTotalAmount * convertedVat - doc.vat_amount);
      if (vatDiff > 0.005) {
        console.error(
          `Expected VAT amount is not ${DEFAULT_VAT_PERCENTAGE}%, but got ${
            doc.vat_amount / (tiplessTotalAmount - doc.vat_amount)
          } for invoice ID=${doc.id}`,
        );
      }

      // TODO: implement based on tax category / sort code
      const isDecreasedVat = false;

      // decorate record with additional fields
      const vatAfterDeduction = doc.vat_amount! * (isDecreasedVat ? DECREASED_VAT_RATIO : 1);
      const amountBeforeVAT = doc.total_amount - vatAfterDeduction;

      partialRecord.foreignVatAfterDeduction = vatAfterDeduction;
      partialRecord.localVatAfterDeduction = vatAfterDeduction * rate;
      partialRecord.foreignAmountBeforeVAT = amountBeforeVAT;
      partialRecord.localAmountBeforeVAT = amountBeforeVAT * rate;
      partialRecord.roundedVATToAdd = Math.round(vatAfterDeduction * rate);
      partialRecord.eventLocalAmount = doc.total_amount * rate;
    }

    records.push(partialRecord);
  }

  return records;
}
