import type {
  Account,
  BusinessMetadata,
  JournalEntry,
} from '@accounter/shaam-uniform-format-generator';
import {
  IGetAdminBusinessesByIdsResult,
  IGetFinancialEntitiesByIdsResult,
} from '@modules/financial-entities/types';
import { IGetLedgerRecordsByIdsResult } from '@modules/ledger/types';

export function journalEntriesFromLedgerRecords(
  ledgerRecords: IGetLedgerRecordsByIdsResult[],
): JournalEntry[] {
  // TODO: Adjust this function to match the actual structure of your ledger records
  return ledgerRecords.map(record => ({
    id: record.id,
    date: record.date,
    description: record.description,
    amount: record.amount,
    accountId: record.accountId,
    financialEntityId: record.financialEntityId,
  }));
}

export function accountsFromFinancialEntities(
  financialEntities: IGetFinancialEntitiesByIdsResult[],
): Account[] {
  // TODO: Adjust this function to match the actual structure of your financial entities
  return financialEntities.map(entity => ({
    id: entity.id,
    name: entity.name,
    taxId: entity.taxId,
    type: entity.type,
    currency: entity.currency,
    financialEntityId: entity.financialEntityId,
  }));
}

export function businessMetadataFromAdminBusiness(
  adminBusiness: IGetAdminBusinessesByIdsResult,
): BusinessMetadata {
  // TODO: Adjust this function to match the actual structure of your admin business
  return {
    id: adminBusiness.id,
    name: adminBusiness.name,
    taxId: adminBusiness.taxId,
  };
}
