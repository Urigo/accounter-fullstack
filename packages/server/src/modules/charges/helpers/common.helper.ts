import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import type { FinancialAmount } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type { IGetChargesByIdsResult } from '../types.js';

export function calculateTotalAmount(charge: IGetChargesByIdsResult): FinancialAmount | null {
  if (charge.type === 'PAYROLL' && charge.transactions_event_amount != null) {
    return formatFinancialAmount(charge.transactions_event_amount, DEFAULT_LOCAL_CURRENCY);
  }
  if (charge.documents_event_amount != null && charge.documents_currency) {
    return formatFinancialAmount(charge.documents_event_amount, charge.documents_currency);
  }
  if (charge.transactions_event_amount != null && charge.transactions_currency) {
    return formatFinancialAmount(charge.transactions_event_amount, charge.transactions_currency);
  }
  return null;
}
