import type { ChargeMatchCardFieldsFragment } from '../../gql/graphql.js';
import { formatTimelessDate } from '../../helpers/dates.js';

export function chargeDate(charge: ChargeMatchCardFieldsFragment): string | undefined {
  const raw = charge.minDocumentsDate ?? charge.minEventDate ?? charge.minDebitDate;
  // Fixed format (matching the app's date cells) — locale-independent,
  // so presentation is consistent across browsers
  return raw ? formatTimelessDate(raw) : undefined;
}

export function chargeTitle(charge: ChargeMatchCardFieldsFragment): string {
  return charge.counterparty?.name ?? charge.userDescription ?? 'Unknown charge';
}
