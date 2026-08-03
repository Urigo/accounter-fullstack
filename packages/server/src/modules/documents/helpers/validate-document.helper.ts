import { Injector } from 'graphql-modules';
import { Currency, DocumentType } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ExchangeProvider } from '../../exchange-rates/providers/exchange.provider.js';
import { VatProvider } from '../../vat/providers/vat.provider.js';
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
  injector: Injector,
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
    const docMonth = document.date.getMonth() + 1; // getMonth is zero-based

    const { defaultLocalCurrency } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();

    // set amount to local currency
    let amount = Math.abs(document.total_amount) - Math.abs(document.vat_amount);
    if (document.currency_code !== defaultLocalCurrency) {
      const exchangeRate = await injector
        .get(ExchangeProvider)
        .getExchangeRates(document.currency_code as Currency, defaultLocalCurrency, document.date);
      amount = amount * exchangeRate;
    }

    if (docYear < 2025) {
      return true;
    }
    if (docYear === 2025 && amount < 20_000) {
      return true;
    }
    if (docYear === 2026) {
      const amountBar = docMonth < 6 ? 10_000 : 5000;
      if (amount < amountBar) {
        return true;
      }
    }
    if (docYear >= 2027 && amount < 5000) {
      return true;
    }
    return !!document.allocation_number && document.allocation_number !== '';
  } catch (error) {
    const message = `Error validating document allocation for document ID=${document.id}`;
    console.error(`${message}: ${error}`);
    throw new Error(message, { cause: error });
  }
}

export function basicDocumentValidation(document: IGetAllDocumentsResult) {
  if (document.type === DocumentType.Unprocessed) {
    return false;
  }
  if (document.type === DocumentType.Other) {
    return true;
  }

  const hasRequiredFields =
    document.debtor_id &&
    document.creditor_id &&
    document.date &&
    document.total_amount != null &&
    document.currency_code &&
    document.serial_number &&
    document.charge_id;

  const isInvoiceValid = !isInvoice(document.type) || document.vat_amount != null;

  return hasRequiredFields && isInvoiceValid;
}

/** result of a single validation check */
export type DocumentValidationCheck = {
  isValid: boolean;
  message: string | null;
};

/** aggregated validation info combining all document validations */
export type DocumentValidationInfo = {
  documentId: string;
  isValid: boolean;
  issues: string[];
  basicValidation: DocumentValidationCheck;
  vatValidation: DocumentValidationCheck;
  allocationValidation: DocumentValidationCheck;
};

/**
 * Runs all document validations (basic required-fields, VAT and allocation) and
 * combines them into a single informative response.
 */
export async function getDocumentValidationInfo(
  document: IGetAllDocumentsResult,
  injector: Injector,
): Promise<DocumentValidationInfo> {
  // basic required-fields validation
  const basicValid = !!basicDocumentValidation(document);
  const basicValidation: DocumentValidationCheck = {
    isValid: basicValid,
    message: basicValid ? null : `Document ID=${document.id} is missing required information`,
  };

  // VAT amount validation
  let vatValid: boolean;
  let vatMessage: string | null = null;
  const vatRate = document.date
    ? await injector
        .get(VatProvider)
        .getVatValueByDateLoader.load(dateToTimelessDateString(document.date))
    : null;
  // a falsy vat_amount (0 / null) means there is no VAT to validate, matching
  // validateDocumentVat's own `!document.vat_amount` short-circuit — so the VAT
  // rate is only required when an actual VAT amount is present.
  if (document.vat_amount && vatRate == null) {
    vatValid = false;
    vatMessage = `Unable to determine VAT rate for document ID=${document.id}`;
  } else {
    vatValid = validateDocumentVat(document, vatRate ?? 0, message => {
      vatMessage = message;
    });
  }
  const vatValidation: DocumentValidationCheck = { isValid: vatValid, message: vatMessage };

  // allocation number validation
  let allocationValid: boolean;
  let allocationMessage: string | null = null;
  try {
    allocationValid = await validateDocumentAllocation(document, injector);
    if (!allocationValid) {
      allocationMessage = `Allocation number is missing for document ID=${document.id}`;
    }
  } catch (error) {
    allocationValid = false;
    allocationMessage =
      error instanceof Error
        ? error.message
        : `Allocation validation failed for document ID=${document.id}`;
  }
  const allocationValidation: DocumentValidationCheck = {
    isValid: allocationValid,
    message: allocationMessage,
  };

  const issues = [basicValidation, vatValidation, allocationValidation]
    .map(check => check.message)
    .filter((message): message is string => !!message);

  return {
    documentId: document.id,
    isValid: basicValid && vatValid && allocationValid,
    issues,
    basicValidation,
    vatValidation,
    allocationValidation,
  };
}
