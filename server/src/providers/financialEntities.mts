import pgQuery from '@pgtyped/query';
import { IGetFinancialEntitiesByIdsQuery } from '../__generated__/financialEntities.types.mjs';

const { sql } = pgQuery;

export const getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE id IN $$ids;`;
