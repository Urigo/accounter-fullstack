import type { IGetChargesByFiltersResult } from '@modules/charges/types';
import type { IGetDocumentsByFiltersResult } from '@modules/documents/types';
import {
  getClosestRateForDate,
  getRateForCurrency,
} from '@modules/exchange-rates/helpers/exchange.helper.js';
import type { IGetExchangeRatesByDatesResult } from '@modules/exchange-rates/types';
import type { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types';
import { TAX_CATEGORIES_WITH_NOT_FULL_VAT } from '@shared/constants';

export type RawVatReportRecord = {
  charge: IGetChargesByFiltersResult;
  doc: IGetDocumentsByFiltersResult;
  business: IGetFinancialEntitiesByIdsResult;
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
  isProperty: boolean;
  vatNumber?: string | null;
  isExpense: boolean;
};

export function adjustTaxRecords(
  rawRecords: Array<RawVatReportRecord>,
  exchangeRatesList: Array<IGetExchangeRatesByDatesResult>,
): RawVatReportRecord2[] {
  const records: RawVatReportRecord2[] = [];

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

    const partialRecord: RawVatReportRecord2 = {
      businessId: charge.business_id,
      chargeDate: charge.transactions_min_event_date ?? charge.documents_min_date!, // must have min_date, as will throw if local doc is missing date
      chargeId: charge.id,
      currencyCode: doc.currency_code,
      documentDate: doc.date,
      documentId: doc.id,
      documentSerial: doc.serial_number,
      documentUrl: doc.image_url,
      documentAmount: String(doc.total_amount),
      vat: doc.vat_amount,
      isProperty: charge.is_property,
      vatNumber: business.vat_number,
      isExpense: doc.debtor_id === charge.owner_id,
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
      const isNotFullVat = TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(partialRecord.businessId);
      // decorate record with additional fields
      const vatAfterDeduction = isNotFullVat ? (doc.vat_amount / 3) * 2 : doc.vat_amount;
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
