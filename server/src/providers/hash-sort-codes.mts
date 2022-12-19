import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { IGetSortCodesByIdsQuery } from '../__generated__/hash-sort-codes.types.mjs';
import { pool } from './db.mjs';

const { sql } = pgQuery;

export const getSortCodesByIds = sql<IGetSortCodesByIdsQuery>`
    SELECT sc.*
    FROM accounter_schema.hash_sort_codes sc
    WHERE ($isSortCodesIds = 0 OR sc.key IN $$sortCodesIds);`;

async function batchSortCodesByIds(sortCodesIds: readonly number[]) {
  const ledgerRecords = await getSortCodesByIds.run(
    {
      isSortCodesIds: sortCodesIds.length > 0 ? 1 : 0,
      sortCodesIds,
    },
    pool,
  );
  return sortCodesIds.map(id => ledgerRecords.find(record => record.key === id));
}

export const getSortCodesByIdLoader = new DataLoader(batchSortCodesByIds, {
  cache: false,
});
