import { Pool } from 'pg';

export const usePool = () => {
  const getPool = () =>
    new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });

  const pool = getPool();

  return {
    getPool,
    pool,
  };
};
