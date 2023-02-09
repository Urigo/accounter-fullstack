import DataLoader from 'dataloader';
import pgQuery from '@pgtyped/query';
import {
  IGetAllFinancialEntitiesQuery,
  IGetFinancialEntitiesByChargeIdsQuery,
  IGetFinancialEntitiesByIdsQuery,
  IGetFinancialEntitiesByNamesQuery,
} from '../__generated__/financial-entities.types.mjs';
import { pool } from './db.mjs';

const { sql } = pgQuery;

const getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE id IN $$ids;`;

async function batchFinancialEntitiesByIds(ids: readonly string[]) {
  const financialEntities = await getFinancialEntitiesByIds.run(
    {
      ids,
    },
    pool,
  );
  return ids.map(id => financialEntities.find(fe => fe.id === id));
}

export const getFinancialEntityByIdLoader = new DataLoader(batchFinancialEntitiesByIds, {
  cache: false,
});

const getFinancialEntitiesByNames = sql<IGetFinancialEntitiesByNamesQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE name IN $$names;`;

async function batchFinancialEntitiesByNames(names: readonly string[]) {
  const financialEntities = await getFinancialEntitiesByNames.run(
    {
      names,
    },
    pool,
  );
  return names.map(name => financialEntities.find(fe => fe.name === name));
}

export const getFinancialEntityByNameLoader = new DataLoader(batchFinancialEntitiesByNames, {
  cache: false,
});

export const getAllFinancialEntities = sql<IGetAllFinancialEntitiesQuery>`
    SELECT *
    FROM accounter_schema.businesses;`;

export const getFinancialEntitiesByChargeIds = sql<IGetFinancialEntitiesByChargeIdsQuery>`
SELECT at.id as transaction_id, bu.*
FROM accounter_schema.all_transactions at
LEFT JOIN accounter_schema.financial_accounts fa
ON  at.account_number = fa.account_number
LEFT JOIN accounter_schema.businesses bu
ON  fa.owner = bu.id
WHERE at.id IN $$chargeIds;`;

async function batchFinancialEntitiesByChargeIds(chargeIds: readonly string[]) {
  const financialEntities = await getFinancialEntitiesByChargeIds.run(
    {
      chargeIds,
    },
    pool,
  );
  return chargeIds.map(
    chargeId => financialEntities.find(fe => fe.transaction_id === chargeId) ?? null,
  );
}

export const getFinancialEntityByChargeIdsLoader = new DataLoader(
  batchFinancialEntitiesByChargeIds,
  { cache: false },
);
