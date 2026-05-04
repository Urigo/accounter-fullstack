import { randomUUID } from 'node:crypto';
import {
  extractAccountIdentifiers,
  type SourceType,
  type ValidatedPayload,
} from './check-accounts.js';
import { getVault, updateVault } from './vault-store.js';
import type { AccountRecord } from './vault.js';

export async function registerDiscoveredAccounts(
  sourceType: SourceType,
  sourceId: string,
  payloads: ValidatedPayload[],
): Promise<void> {
  const existing = getVault().accountRecords;
  const newRecords: AccountRecord[] = [];

  for (const payload of payloads) {
    for (const accountNumber of extractAccountIdentifiers(sourceType, payload)) {
      const alreadyKnown = existing.some(
        r => r.sourceType === sourceType && r.accountNumber === accountNumber,
      );
      if (
        !alreadyKnown &&
        !newRecords.some(
          r =>
            r.sourceType === sourceType &&
            r.sourceId === sourceId &&
            r.accountNumber === accountNumber,
        )
      ) {
        newRecords.push({
          id: randomUUID(),
          sourceId,
          sourceType,
          accountNumber,
          status: 'pending' as const,
        });
      }
    }
  }

  if (newRecords.length > 0) {
    await updateVault(v => ({
      ...v,
      accountRecords: [...v.accountRecords, ...newRecords],
    }));
  }
}
