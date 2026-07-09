import type { ChargeMatchCardFieldsFragment } from '../../gql/graphql.js';

export function chargeDate(charge: ChargeMatchCardFieldsFragment): string | undefined {
  const raw = charge.minDocumentsDate ?? charge.minEventDate ?? charge.minDebitDate;
  // Date-only strings parse as UTC midnight; format in UTC so users in
  // negative offsets don't see the previous day
  return raw ? new Date(raw).toLocaleDateString(undefined, { timeZone: 'UTC' }) : undefined;
}

export function chargeTitle(charge: ChargeMatchCardFieldsFragment): string {
  return charge.counterparty?.name ?? charge.userDescription ?? 'Unknown charge';
}
