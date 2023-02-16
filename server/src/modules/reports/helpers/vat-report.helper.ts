import type { ChargesTypes } from '@modules/charges';
import type { DocumentsTypes } from '@modules/documents';
import type { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types.js';
import {
  getClosestRateForDate,
  getILSForDate,
  getRateForCurrency,
} from '@modules/ledger/helpers/exchange.helper.js';
import type { IGetExchangeRatesByDatesResult } from '@modules/ledger/types.js';
import type { IGetTaxTransactionsByIDsResult } from '@modules/reports/types.js';
import { TAX_CATEGORIES_WITH_NOT_FULL_VAT } from '@shared/constants';

export function mergeChargeDoc(
  charge: ChargesTypes.IGetChargesByIdsResult,
  doc: DocumentsTypes.IGetDocumentsByFiltersResult,
  business?: IGetFinancialEntitiesByIdsResult,
) {
  return {
    tax_invoice_date: doc.date,
    tax_invoice_number: doc.serial_number,
    tax_invoice_amount: doc.total_amount,
    currency_code: doc.currency_code,
    document_image_url: doc.image_url,
    document_id: doc.id,
    tax_category: charge.tax_category,
    event_date: charge.event_date,
    debit_date: charge.debit_date,
    event_amount: charge.event_amount,
    financial_entity: charge.financial_entity,
    vat: charge.vat,
    user_description: charge.user_description,
    bank_description: charge.bank_description,
    withholding_tax: charge.withholding_tax,
    interest: charge.interest,
    id: charge.id,
    detailed_bank_description: charge.detailed_bank_description,
    receipt_number: charge.receipt_number,
    business_trip: charge.business_trip,
    personal_category: charge.personal_category,
    financial_accounts_to_balance: charge.financial_accounts_to_balance,
    bank_reference: charge.bank_reference,
    event_number: charge.event_number,
    account_number: charge.account_number,
    account_type: charge.account_type,
    is_conversion: charge.is_conversion,
    currency_rate: charge.currency_rate,
    contra_currency_code: charge.contra_currency_code,
    original_id: charge.original_id,
    reviewed: charge.reviewed,
    hashavshevet_id: charge.hashavshevet_id,
    current_balance: charge.current_balance,
    tax_invoice_file: charge.tax_invoice_file,
    links: charge.links,
    receipt_image: charge.receipt_image,
    receipt_url: charge.receipt_url,
    receipt_date: charge.receipt_date,
    is_property: charge.is_property,
    tax_invoice_currency: charge.tax_invoice_currency,
    vat_number: business?.vat_number,
  };
}

export type RawVatReportRecord = ReturnType<typeof mergeChargeDoc>;
export type DecoratedVatReportRecord = RawVatReportRecord & {
  currency_code: string;
  vatAfterDeduction?: number;
  amountBeforeVAT?: number;
  amountBeforeFullVAT?: number;
  roundedVATToAdd?: number;
  eventAmountILS?: number;
  vatAfterDeductionILS?: number;
};

export function adjustTaxRecords(
  rawRecords: Array<RawVatReportRecord>,
  referenceTransactions: { [id: string]: IGetTaxTransactionsByIDsResult },
  exchangeRatesList: Array<IGetExchangeRatesByDatesResult>,
): DecoratedVatReportRecord[] {
  const sharedInvoiceIDs: Array<string> = [];
  const records: DecoratedVatReportRecord[] = [];

  for (const rawRecord of rawRecords) {
    if (!rawRecord.currency_code) {
      throw new Error(`Currency missing for invoice of charge ID=${rawRecord.id}`);
    }
    const decoratedRecord: DecoratedVatReportRecord = {
      ...rawRecord,
      currency_code: rawRecord.currency_code,
    };

    // handle invoice with multiple charges
    const ref = referenceTransactions[rawRecord.id];
    if (ref?.id) {
      if (sharedInvoiceIDs.includes(ref.id)) {
        /* case record was already added to the report by reference transaction */
        continue;
      } else {
        /* case first record of reference transaction */
        sharedInvoiceIDs.push(ref.id);

        // TODO: update "taxes" DB table, make tax_invoice_amount and vat required, then remove redundant alternatives here:
        decoratedRecord.event_amount = ref.tax_invoice_amount || decoratedRecord.event_amount;
        decoratedRecord.tax_invoice_amount = ref.tax_invoice_amount
          ? Number(ref.tax_invoice_amount)
          : null;
        decoratedRecord.vat = ref.vat ? Number(ref.vat) : null;
        decoratedRecord.tax_invoice_date = ref.tax_invoice_date;
        decoratedRecord.document_image_url = ref.tax_invoice_image;
        decoratedRecord.tax_invoice_number = ref.tax_invoice_number;
        decoratedRecord.tax_invoice_file = ref.tax_invoice_file;
      }
    }

    // get exchange rates
    if (!decoratedRecord.tax_invoice_date) {
      throw new Error(`Date is missing for invoice of charge ID=${decoratedRecord.id}`);
    }
    const exchangeRate = getClosestRateForDate(decoratedRecord.tax_invoice_date, exchangeRatesList);

    // update record amounts according to document currency rate
    if (decoratedRecord.tax_invoice_currency) {
      const amountToUse =
        decoratedRecord.tax_invoice_amount ?? parseFloat(decoratedRecord.event_amount);

      const rate = getRateForCurrency(decoratedRecord.tax_invoice_currency, exchangeRate);

      decoratedRecord.event_amount = String(
        (decoratedRecord.tax_invoice_amount = amountToUse * rate),
      );
      decoratedRecord.debit_date = decoratedRecord.tax_invoice_date;
      decoratedRecord.vat &&= decoratedRecord.vat * rate;
    }

    // set default amountBeforeVAT
    if (!decoratedRecord.vat) {
      const amountToUse =
        decoratedRecord.tax_invoice_amount ?? parseFloat(decoratedRecord.event_amount);
      const rate = getRateForCurrency(decoratedRecord.currency_code, exchangeRate);
      decoratedRecord.amountBeforeVAT = amountToUse * rate;
    }

    if (decoratedRecord.tax_category && decoratedRecord.vat) {
      // decorate record with additional fields
      const amountToUse =
        decoratedRecord.tax_invoice_amount ?? parseFloat(decoratedRecord.event_amount);
      const vatAfterDeduction = TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(
        decoratedRecord.tax_category,
      )
        ? (decoratedRecord.vat / 3) * 2
        : decoratedRecord.vat;
      // TODO: Add a check if there is vat and it's not equal for 17 percent, let us know
      const amountBeforeVAT = amountToUse - vatAfterDeduction;

      const amountBeforeFullVAT = amountToUse - decoratedRecord.vat;

      // enrich record with ILS amounts
      const ILSAmounts = getILSForDate(
        { ...decoratedRecord, vatAfterDeduction, amountBeforeVAT, amountBeforeFullVAT },
        exchangeRate,
      );

      decoratedRecord.vatAfterDeduction = vatAfterDeduction;
      decoratedRecord.amountBeforeFullVAT = amountBeforeFullVAT;
      decoratedRecord.roundedVATToAdd = Math.round(ILSAmounts.vatAfterDeductionILS);
      decoratedRecord.amountBeforeVAT = ILSAmounts.amountBeforeFullVATILS;
      decoratedRecord.eventAmountILS = ILSAmounts.eventAmountILS;
      decoratedRecord.vatAfterDeductionILS = ILSAmounts.vatAfterDeductionILS;
    }

    records.push(decoratedRecord);
  }

  return records;
}
