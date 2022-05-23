import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { pool } from '../providers/db.mjs';
import { IGetFinancialEntitiesByIdsQuery } from '../__generated__/financialEntities.types.mjs';

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

export const getFinancialEntitieByIdLoader = new DataLoader(batchFinancialEntitiesByIds, { cache: false });
