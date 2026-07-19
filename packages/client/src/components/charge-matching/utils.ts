import { format } from 'date-fns';
import type { ChargeMatchCardFieldsFragment } from '../../gql/graphql.js';

export function chargeDate(charge: ChargeMatchCardFieldsFragment): string | undefined {
  const raw = charge.minDocumentsDate ?? charge.minEventDate ?? charge.minDebitDate;
  // Fixed format via date-fns (matching the app's date cells) — locale-independent,
  // so presentation is consistent across browsers
  return raw ? format(new Date(raw), 'dd/MM/yy') : undefined;
}

export function chargeTitle(charge: ChargeMatchCardFieldsFragment): string {
  return charge.counterparty?.name ?? charge.userDescription ?? 'Unknown charge';
}
