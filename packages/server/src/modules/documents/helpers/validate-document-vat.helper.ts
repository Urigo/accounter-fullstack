import { DEFAULT_VAT_PERCENTAGE } from '@shared/constants';
import type { IGetAllDocumentsResult } from '../types.js';

export function validateDocumentVat(
  document: IGetAllDocumentsResult,
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

  const convertedVat = DEFAULT_VAT_PERCENTAGE / (1 + DEFAULT_VAT_PERCENTAGE);
  const tiplessTotalAmount =
    document.total_amount - (document.no_vat_amount ? Number(document.no_vat_amount) : 0);
  const vatDiff = Math.abs(tiplessTotalAmount * convertedVat - document.vat_amount);
  if (vatDiff > 0.005) {
    onError(
      `Expected VAT amount is not ${DEFAULT_VAT_PERCENTAGE}%, but got ${
        document.vat_amount / (tiplessTotalAmount - document.vat_amount)
      } for invoice ID=${document.id}`,
    );
    return false;
  }
  return true;
}
