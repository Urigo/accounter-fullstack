import { Injector } from 'graphql-modules';
import type { IGetChargesByFiltersResult } from '@modules/charges/types';
import type { IGetDocumentsByFiltersResult } from '@modules/documents/types';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import type { IGetBusinessesByIdsResult } from '@modules/financial-entities/types';
import {
  DECREASED_VAT_RATIO,
  DEFAULT_LOCAL_CURRENCY,
  DEFAULT_VAT_PERCENTAGE,
} from '@shared/constants';
import { Currency, DocumentType } from '@shared/enums';
import type { AccountantStatus } from '@shared/gql-types';
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
  chargeAccountantStatus: AccountantStatus;
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

export async function adjustTaxRecord(
  rawRecord: VatReportRecordSources,
  injector: Injector,
): Promise<RawVatReportRecord> {
  try {
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
    const rate = await injector
      .get(ExchangeProvider)
      .getExchangeRates(currency, DEFAULT_LOCAL_CURRENCY, doc.date);

    const creditInvoiceFactor = doc.type === DocumentType.CreditInvoice ? -1 : 1;
    const vatAmount = doc.vat_amount ? doc.vat_amount * creditInvoiceFactor : 0;
    const totalAmount = doc.total_amount * creditInvoiceFactor;
    const noVatAmount = doc.no_vat_amount ? Number(doc.no_vat_amount) * creditInvoiceFactor : 0;

    const partialRecord: RawVatReportRecord = {
      businessId: charge.business_id,
      chargeAccountantStatus: charge.accountant_status,
      chargeDate: charge.transactions_min_event_date ?? charge.documents_min_date!, // must have min_date, as will throw if local doc is missing date
      chargeId: charge.id,
      currencyCode: currency,
      documentDate: doc.date,
      documentId: doc.id,
      documentSerial: doc.serial_number,
      documentUrl: doc.image_url,
      documentAmount: String(creditInvoiceFactor * totalAmount),
      foreignVat: doc.currency_code === DEFAULT_LOCAL_CURRENCY ? null : vatAmount,
      localVat: doc.currency_code === DEFAULT_LOCAL_CURRENCY ? vatAmount : null,
      isProperty: charge.is_property,
      vatNumber: business.vat_number,
      isExpense:
        doc.type === DocumentType.CreditInvoice
          ? doc.debtor_id !== charge.owner_id
          : doc.debtor_id === charge.owner_id,
    };

    // set default amountBeforeVAT
    if (!vatAmount) {
      partialRecord.localAmountBeforeVAT = (totalAmount - noVatAmount) * rate;
    } else if (partialRecord.businessId) {
      // TODO: figure out how to handle VAT != DEFAULT_VAT_PERCENTAGE
      const convertedVat = DEFAULT_VAT_PERCENTAGE / (1 + DEFAULT_VAT_PERCENTAGE);
      const tiplessTotalAmount = totalAmount - noVatAmount;
      const vatDiff = Math.abs(tiplessTotalAmount * convertedVat - vatAmount);
      if (vatDiff > 0.005) {
        console.error(
          `Expected VAT amount is not ${DEFAULT_VAT_PERCENTAGE}%, but got ${
            vatAmount / (tiplessTotalAmount - vatAmount)
          } for invoice ID=${doc.id}`,
        );
      }

      // TODO: implement based on tax category / sort code
      const isDecreasedVat = false;

      // decorate record with additional fields
      const vatAfterDeduction = vatAmount * (isDecreasedVat ? DECREASED_VAT_RATIO : 1);
      const amountBeforeVAT = totalAmount - vatAfterDeduction;

      partialRecord.foreignVatAfterDeduction = vatAfterDeduction;
      partialRecord.localVatAfterDeduction = vatAfterDeduction * rate;
      partialRecord.foreignAmountBeforeVAT = amountBeforeVAT;
      partialRecord.localAmountBeforeVAT = amountBeforeVAT * rate;
      partialRecord.roundedVATToAdd = Math.round(vatAfterDeduction * rate);
      partialRecord.eventLocalAmount = totalAmount * rate;
    }

    return partialRecord;
  } catch (e) {
    console.error(e);
    throw e;
  }
}
