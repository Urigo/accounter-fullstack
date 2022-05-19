import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { pool } from '../providers/db.mjs';
import {
  IGetLedgerRecordsByChargeIdsQuery,
} from '../__generated__/ledgerRecords.types.mjs';

const { sql } = pgQuery;

const getLedgerRecordsByChargeIds = sql<IGetLedgerRecordsByChargeIdsQuery>`
    SELECT *
    FROM accounter_schema.ledger
    WHERE original_id IN $$chargeIds;`;

async function batchLedgerRecordsByChargeIds(chargeIds: readonly string[]) {
  const ledgerRecords = await getLedgerRecordsByChargeIds.run(
    {
        chargeIds,
    },
    pool
  );
  return chargeIds.map(id => ledgerRecords.filter(record => record.original_id === id));
}

export const getLedgerRecordsByChargeIdLoader = new DataLoader(batchLedgerRecordsByChargeIds);

