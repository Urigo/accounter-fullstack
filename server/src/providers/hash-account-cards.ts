import DataLoader from 'dataloader';
import pgQuery from '@pgtyped/query';
import {
  IGetAccountCardsByKeysQuery,
  IGetAccountCardsBySortCodesQuery,
} from '../__generated__/hash-account-cards.types.js';
import { pool } from './db.js';

const { sql } = pgQuery;

export const getAccountCardsBySortCodes = sql<IGetAccountCardsBySortCodesQuery>`
    SELECT ac.*
    FROM accounter_schema.hash_account_cards ac
    WHERE ($isSortCodes = 0 OR ac.sort_code IN $$sortCodesIds);`;

async function batchAccountCardsBySortCodes(sortCodesIds: readonly number[]) {
  const accountCards = await getAccountCardsBySortCodes.run(
    {
      isSortCodes: sortCodesIds.length > 0 ? 1 : 0,
      sortCodesIds,
    },
    pool,
  );
  return sortCodesIds.map(id => accountCards.filter(record => record.sort_code === id));
}

export const getAccountCardsBySortCodesLoader = new DataLoader(batchAccountCardsBySortCodes, {
  cache: false,
});

const getAccountCardsByKeys = sql<IGetAccountCardsByKeysQuery>`
    SELECT ac.*
    FROM accounter_schema.hash_account_cards ac
    WHERE ($isKeys = 0 OR ac.key IN $$keys);`;

async function batchAccountCardsByKeys(keys: readonly string[]) {
  const accountCards = await getAccountCardsByKeys.run(
    {
      isKeys: keys.length > 0 ? 1 : 0,
      keys,
    },
    pool,
  );
  return keys.map(key => accountCards.find(record => record.key === key));
}

export const getAccountCardsByKeysLoader = new DataLoader(batchAccountCardsByKeys, {
  cache: false,
});
