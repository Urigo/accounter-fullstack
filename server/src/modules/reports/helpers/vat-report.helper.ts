import type { IGetChargesByFiltersResult } from '@modules/charges/types';
import type { IGetDocumentsByFiltersResult } from '@modules/documents/types';
import {
  getClosestRateForDate,
  getRateForCurrency,
} from '@modules/ledger/helpers/exchange.helper.js';
import type { IGetExchangeRatesByDatesResult } from '@modules/ledger/types.js';
import { TAX_CATEGORIES_WITH_NOT_FULL_VAT } from '@shared/constants';

// export function mergeChargeDoc(
//   charge: ChargesTypes.IGetChargesByIdsResult,
//   doc: DocumentsTypes.IGetDocumentsByFiltersResult,
//   business?: IGetFinancialEntitiesByIdsResult,
// ) {
//   return {
//     tax_invoice_date: doc.date,
//     tax_invoice_number: doc.serial_number,
//     tax_invoice_amount: doc.total_amount,
//     currency_code: doc.currency_code,
//     document_image_url: doc.image_url,
//     document_id: doc.id,
//     tax_category: charge.tax_category,
//     event_date: charge.event_date,
//     debit_date: charge.debit_date,
//     event_amount: charge.event_amount,
//     financial_entity_id: charge.financial_entity_id,
//     vat: charge.vat,
//     user_description: charge.user_description,
//     bank_description: charge.bank_description,
//     withholding_tax: charge.withholding_tax,
//     interest: charge.interest,
//     id: charge.id,
//     detailed_bank_description: charge.detailed_bank_description,
//     receipt_number: charge.receipt_number,
//     business_trip: charge.business_trip,
//     personal_category: charge.personal_category,
//     financial_accounts_to_balance: charge.financial_accounts_to_balance,
//     bank_reference: charge.bank_reference,
//     event_number: charge.event_number,
//     account_number: charge.account_number,
//     account_type: charge.account_type,
//     is_conversion: charge.is_conversion,
//     currency_rate: charge.currency_rate,
//     contra_currency_code: charge.contra_currency_code,
//     original_id: charge.original_id,
//     reviewed: charge.reviewed,
//     hashavshevet_id: charge.hashavshevet_id,
//     current_balance: charge.current_balance,
//     tax_invoice_file: charge.tax_invoice_file,
//     links: charge.links,
//     receipt_image: charge.receipt_image,
//     receipt_url: charge.receipt_url,
//     receipt_date: charge.receipt_date,
//     is_property: charge.is_property,
//     tax_invoice_currency: charge.tax_invoice_currency,
//     vat_number: business?.vat_number,
//   };
// }

export type RawVatReportRecord = {
  charge: IGetChargesByFiltersResult;
  doc: IGetDocumentsByFiltersResult;
};
export type DecoratedVatReportRecord = RawVatReportRecord & {
  currency_code: string;
  vatAfterDeduction?: number;
  amountBeforeVAT?: number;
  amountBeforeFullVAT?: number;
  roundedVATToAdd?: number;
  eventAmountILS?: number;
  vatAfterDeductionILS?: number;
};

export type RawVatReportRecord2 = {
  amountBeforeVAT?: number;
  eventAmountILS?: number;
  roundedVATToAdd?: number;
  vat: number | null;
  vatAfterDeduction?: number;
  vatAfterDeductionILS?: number;

  //
  documentId: string;
  documentUrl: string | null;
  documentAmount: string;
  chargeId: string;
  businessId: string | null;
  currencyCode: string;
  chargeDate: Date;
  documentDate: Date | null;
  documentSerial: string | null;
};

export function adjustTaxRecords(
  rawRecords: Array<RawVatReportRecord>,
  exchangeRatesList: Array<IGetExchangeRatesByDatesResult>,
): RawVatReportRecord2[] {
  const records: RawVatReportRecord2[] = [];

  for (const rawRecord of rawRecords) {
    const { charge, doc } = rawRecord;

    if (!doc.total_amount) {
      throw new Error(`Amount missing for invoice ID=${doc.id}`);
    }

    if (!doc.currency_code) {
      throw new Error(`Currency missing for invoice ID=${doc.id}`);
    }
    if (!doc.date) {
      throw new Error(`Date is missing for invoice ID=${doc.id}`);
    }

    const partialRecord: RawVatReportRecord2 = {
      // amountBeforeVAT
      businessId: charge.business_id,
      chargeDate: charge.transactions_min_event_date ?? charge.documents_min_date!, // must have min_date, as will throw if local doc is missing date
      chargeId: charge.id,
      currencyCode: doc.currency_code,
      documentDate: doc.date,
      documentId: doc.id,
      documentSerial: doc.serial_number,
      documentUrl: doc.image_url,
      documentAmount: String(doc.total_amount),
      // eventAmountILS
      // roundedVATToAdd
      vat: doc.vat_amount,
      // vatAfterDeduction
      // vatAfterDeductionILS
    };

    // get exchange rate
    const exchangeRates = getClosestRateForDate(doc.date, exchangeRatesList);
    const rate = getRateForCurrency(doc.currency_code, exchangeRates);

    // update record amounts according to document currency rate
    partialRecord.documentAmount = String((doc.total_amount = doc.total_amount * rate));
    doc.vat_amount &&= doc.vat_amount * rate;

    // set default amountBeforeVAT
    if (!doc.vat_amount) {
      partialRecord.amountBeforeVAT = doc.total_amount * rate;
    }

    if (partialRecord.businessId && doc.vat_amount) {
      // decorate record with additional fields
      const vatAfterDeduction = TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(partialRecord.businessId)
        ? (doc.vat_amount / 3) * 2
        : doc.vat_amount;
      // TODO: Add a check if there is vat and it's not equal for 17 percent, let us know
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
