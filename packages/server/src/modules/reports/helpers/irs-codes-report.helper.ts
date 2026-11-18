import { compareTimelessDates } from '../../../shared/helpers/index.js';
import type { IGetAllFinancialEntitiesResult } from '../../financial-entities/types.js';
import type { IGetLedgerRecordsByDatesResult } from '../../ledger/types.js';
import type { CommentarySubRecordProto } from '../types.js';

export type IrsCodeGroup = {
  /** null for financial entities with no IRS code */
  irsCode: number | null;
  amount: number;
  entities: CommentarySubRecordProto[];
};

type EntityAccumulator = {
  name: string;
  amount: number;
  // keyed by ID, so a record touching the same entity on multiple sides is listed once
  ledgerRecords: Map<string, IGetLedgerRecordsByDatesResult>;
};

const LEDGER_SLOTS = [
  { entity: 'credit_entity1', amount: 'credit_local_amount1', sign: 1 },
  { entity: 'credit_entity2', amount: 'credit_local_amount2', sign: 1 },
  { entity: 'debit_entity1', amount: 'debit_local_amount1', sign: -1 },
  { entity: 'debit_entity2', amount: 'debit_local_amount2', sign: -1 },
] as const;

/**
 * Groups ledger records by the IRS code of each side's financial entity, then by entity.
 * An entity without its own IRS code falls back to its sort code's default IRS code.
 * Amounts are credit minus debit (local currency). Codes are sorted ascending, with the
 * no-IRS-code (misc) group last.
 */
export function groupLedgerRecordsByIrsCode(
  ledgerRecords: IGetLedgerRecordsByDatesResult[],
  entitiesById: Map<
    string,
    Pick<IGetAllFinancialEntitiesResult, 'id' | 'name' | 'irs_code' | 'sort_code'>
  >,
  defaultIrsCodeBySortCode: Map<number, number> = new Map(),
): IrsCodeGroup[] {
  const groups = new Map<number | null, Map<string, EntityAccumulator>>();

  for (const record of ledgerRecords) {
    for (const slot of LEDGER_SLOTS) {
      const entityId = record[slot.entity];
      if (!entityId) {
        continue;
      }
      const entity = entitiesById.get(entityId);
      const irsCode =
        entity?.irs_code ??
        (entity?.sort_code == null ? null : defaultIrsCodeBySortCode.get(entity.sort_code)) ??
        null;
      const amount = Number(record[slot.amount] ?? 0) * slot.sign;

      let group = groups.get(irsCode);
      if (!group) {
        group = new Map();
        groups.set(irsCode, group);
      }
      let accumulator = group.get(entityId);
      if (!accumulator) {
        accumulator = { name: entity?.name ?? entityId, amount: 0, ledgerRecords: new Map() };
        group.set(entityId, accumulator);
      }
      accumulator.amount += amount;
      accumulator.ledgerRecords.set(record.id, record);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === b) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    })
    .map(([irsCode, entities]) => {
      const sortedEntities = Array.from(entities.entries())
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .map(([financialEntityId, { amount, ledgerRecords }]) => ({
          financialEntityId,
          amount,
          ledgerRecords: Array.from(ledgerRecords.values()).sort((a, b) =>
            compareTimelessDates(a.invoice_date, b.invoice_date),
          ),
        }));
      return {
        irsCode,
        amount: sortedEntities.reduce((sum, entity) => sum + entity.amount, 0),
        entities: sortedEntities,
      };
    });
}
