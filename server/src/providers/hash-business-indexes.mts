import DataLoader from 'dataloader';
import pgQuery from '@pgtyped/query';
import { IGetHashavshevetBusinessIndexesQuery } from '../__generated__/hash-business-indexes.types.mjs';
import { pool } from './db.mjs';

const { sql } = pgQuery;

const getHashavshevetBusinessIndexes = sql<IGetHashavshevetBusinessIndexesQuery>`
    SELECT hbi.*, b.name as business_name
    FROM accounter_schema.hash_business_indexes hbi
    LEFT JOIN accounter_schema.businesses b
    ON hbi.business = b.id
    WHERE
        hbi.hash_owner = $financialEntityId
        AND b.name IN $$businessNames;`;

async function batchHashavshevetBusinessIndexes(
  params: readonly { financialEntityId: string; businessName: string }[],
) {
  const dict: Record<string, string[]> = {};
  params.forEach(({ financialEntityId, businessName }) => {
    dict[financialEntityId] ||= [];
    if (!dict[financialEntityId].includes(businessName)) {
      dict[financialEntityId].push(businessName);
    }
  });
  const financialEntityIds = Object.keys(dict);
  const res = await Promise.all(
    financialEntityIds.map(id =>
      getHashavshevetBusinessIndexes.run(
        {
          financialEntityId: id,
          businessNames: dict[id],
        },
        pool,
      ),
    ),
  );
  const indexes = res.flat();
  return params.map(({ financialEntityId, businessName }) =>
    indexes.find(
      index => index.hash_owner === financialEntityId && index.business_name === businessName,
    ),
  );
}

export const getHashavshevetBusinessIndexesLoader = new DataLoader(
  batchHashavshevetBusinessIndexes,
  { cache: false },
);
