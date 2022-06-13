import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { pool } from './db.mjs';
import {
  IGetFinancialEntitiesByIdsQuery,
  IGetFinancialEntitiesByNamesQuery,
} from '../__generated__/financialEntities.types.mjs';

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
    pool
  );
  return ids.map(id => financialEntities.find(fe => fe.id === id));
}

export const getFinancialEntityByIdLoader = new DataLoader(batchFinancialEntitiesByIds, { cache: false });

const getFinancialEntitiesByNames = sql<IGetFinancialEntitiesByNamesQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE name IN $$names;`;

async function batchFinancialEntitiesByNames(names: readonly string[]) {
  const financialEntities = await getFinancialEntitiesByNames.run(
    {
      names,
    },
    pool
  );
  return names.map(name => financialEntities.find(fe => fe.name === name));
}

export const getFinancialEntityByNameLoader = new DataLoader(batchFinancialEntitiesByNames, { cache: false });
