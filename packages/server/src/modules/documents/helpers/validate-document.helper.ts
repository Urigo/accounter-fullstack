import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { Currency, DocumentType } from '@shared/gql-types';
import type { IGetAllDocumentsResult } from '../types.js';
import { isInvoice } from './common.helper.js';

export function validateDocumentVat(
  document: IGetAllDocumentsResult,
  vatValue: number,
  onError: (message: string) => void,
  requireVat: boolean = false,
): boolean {
  if (!document.total_amount) {
    onError(`Amount missing for invoice ID=${document.id}`);
    return false;
  }

  if (!document.vat_amount) {
    if (requireVat) {
      onError(`VAT amount missing for invoice ID=${document.id}`);
      return false;
    }
    return true;
  }

  const convertedVat = vatValue / (1 + vatValue);
  const tiplessTotalAmount =
    document.total_amount - (document.no_vat_amount ? Number(document.no_vat_amount) : 0);
  const vatDiff = Math.abs(tiplessTotalAmount * convertedVat - document.vat_amount);
  if (vatDiff > 0.005) {
    onError(
      `Expected VAT amount is not ${vatValue * 100}%, but got ${
        document.vat_amount / (tiplessTotalAmount - document.vat_amount)
      } for invoice ID=${document.id}`,
    );
    return false;
  }
  return true;
}

export async function validateDocumentAllocation(
  document: IGetAllDocumentsResult,
  context: GraphQLModules.Context,
): Promise<boolean> {
  try {
    if (document.type !== DocumentType.InvoiceReceipt && document.type !== DocumentType.Invoice) {
      return true;
    }
    if (!document.vat_amount) {
      return true;
    }
    if (!document.date || !document.total_amount || !document.currency_code) {
      // cannot validate without date, amount and currency
      return false;
    }
    const docYear = document.date.getFullYear();

    // set amount to local currency
    let amount = Math.abs(document.total_amount) - Math.abs(document.vat_amount);
    if (document.currency_code !== context.adminContext.defaultLocalCurrency) {
      const exchangeRate = await context.injector
        .get(ExchangeProvider)
        .getExchangeRates(
          document.currency_code as Currency,
          context.adminContext.defaultLocalCurrency,
          document.date,
        );
      amount = amount * exchangeRate;
    }

    if (docYear < 2025) {
      return true;
    }
    if (docYear === 2025 && amount < 20_000) {
      return true;
    }
    if (docYear === 2026 && amount < 15_000) {
      return true;
    }
    if (docYear === 2027 && amount < 10_000) {
      return true;
    }
    if (docYear === 2028 && amount < 5000) {
      return true;
    }
    return !!document.allocation_number && document.allocation_number !== '';
  } catch (error) {
    const message = `Error validating document allocation for document ID=${document.id}`;
    console.error(`${message}: ${error}`);
    throw new Error(message);
  }
}

export function basicDocumentValidation(document: IGetAllDocumentsResult) {
  if (document.type === DocumentType.Unprocessed) {
    return false;
  }
  if (document.type === DocumentType.Other) {
    return true;
  }

  if (!document.debtor_id || !document.creditor_id) {
    return false;
  }
  if (!document.date) {
    return false;
  }
  if (document.total_amount == null || !document.currency_code) {
    return false;
  }
  if (isInvoice(document.type) && document.vat_amount == null) {
    return false;
  }
  if (!document.serial_number) {
    return false;
  }
  if (!document.charge_id) {
    return false;
  }
  return true;
}
