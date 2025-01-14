import { useExtendContext } from 'graphql-yoga';
import pg from 'pg';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import { Environment } from '@shared/types';
import { env } from '../environment.js';
import type { IGetAdminBusinessContextQuery } from './__generated__/admin-context-plugin.types.js';
import { UserType } from './auth-plugin.js';

const getAdminBusinessContext = sql<IGetAdminBusinessContextQuery>`
  SELECT *
  FROM accounter_schema.user_context
  WHERE owner_id = $adminBusinessId`;

export type AdminContext = {
  dummy: void;
};

const cache = getCacheInstance({
  stdTTL: 60,
});

async function fetchContext(adminBusinessId: string) {
  const context = cache.get<AdminContext>(adminBusinessId);
  if (context) {
    return context;
  }

  const client = new pg.Client({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const [context] = await getAdminBusinessContext.run({ adminBusinessId }, client);
    if (!context) {
      throw new Error('Admin business context not found');
    }
    cache.set(adminBusinessId, context);

    return context;
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

export const adminContextPlugin = () =>
  useExtendContext(async (contextSoFar: { env: Environment; currentUser: UserType }) => {
    const adminContext = await fetchContext(contextSoFar.currentUser.userId);
    return {
      adminContext,
    };
  });
