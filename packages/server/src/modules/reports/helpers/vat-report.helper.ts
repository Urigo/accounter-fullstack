import { GraphQLError } from 'graphql';
import type { IGetChargesByFiltersResult } from '@modules/charges/types';
import type { IGetDocumentsByFiltersResult } from '@modules/documents/types';
import {
  getClosestRateForDate,
  getRateForCurrency,
} from '@modules/exchange-rates/helpers/exchange.helper.js';
import type { IGetExchangeRatesByDatesResult } from '@modules/exchange-rates/types';
import type { IGetBusinessesByIdsResult } from '@modules/financial-entities/types';
import { DECREASED_VAT_RATIO, DEFAULT_VAT_PERCENTAGE } from '@shared/constants';
import { DocumentType } from '@shared/enums';

export type VatReportRecordSources = {
  charge: IGetChargesByFiltersResult;
  doc: IGetDocumentsByFiltersResult;
  business: IGetBusinessesByIdsResult;
};

export type RawVatReportRecord = {
  amountBeforeVAT?: number;
  businessId: string | null;
  chargeAccountantReviewed: boolean;
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
    const vat = doc.vat_amount ? doc.vat_amount * rate : null;

    const partialRecord: RawVatReportRecord = {
      businessId: charge.business_id,
      chargeAccountantReviewed: charge.accountant_reviewed,
      chargeDate: charge.transactions_min_event_date ?? charge.documents_min_date!, // must have min_date, as will throw if local doc is missing date
      chargeId: charge.id,
      currencyCode: doc.currency_code,
      documentDate: doc.date,
      documentId: doc.id,
      documentSerial: doc.serial_number,
      documentUrl: doc.image_url,
      documentAmount: String((doc.type === DocumentType.CreditInvoice ? -1 : 1) * doc.total_amount),
      vat,
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
      // TODO: figure out how to handle VAT != DEFAULT_VAT_PERCENTAGE
      const convertedVat = DEFAULT_VAT_PERCENTAGE / (1 + DEFAULT_VAT_PERCENTAGE);
      const tiplessTotalAmount =
        doc.total_amount - (doc.no_vat_amount ? Number(doc.no_vat_amount) : 0);
      const vatDiff = Math.abs(tiplessTotalAmount * convertedVat - doc.vat_amount!);
      if (vatDiff > 0.005) {
        throw new GraphQLError(
          `Expected VAT amount is not ${DEFAULT_VAT_PERCENTAGE}%, but got ${
            doc.vat_amount! / (tiplessTotalAmount - doc.vat_amount!)
          } for invoice ID=${doc.id}`,
        );
      }

      // TODO: implement based on tax category / sort code
      const isDecreasedVat = false;

      // decorate record with additional fields
      const vatAfterDeduction = partialRecord.vat * (isDecreasedVat ? DECREASED_VAT_RATIO : 1);
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
