import { config } from 'dotenv';
import postgres from 'pg';

const { Pool } = postgres;

config({ path: '../.env' });

export const pool = new Pool({
  connectionString: process.env.PGURI,
  ssl: {
    rejectUnauthorized: false,
  },
});
