// returns the database URL
// This is a script used for later setting DATABASE_URL environment variable for the PgTyped dependency.
import { config as appConfig } from '../src/env.ts';

const {
  user = 'postgres',
  password = 'postgres',
  host = 'localhost',
  port = 5432,
  database = 'postgres',
  ssl = null,
} = appConfig?.database ?? {};

const dbUrl = `postgres://${user}:${password}@${host}:${port}/${database}${
  ssl ? '?sslmode=require' : '?sslmode=disable'
}`;

// eslint-disable-next-line no-console
console.log(dbUrl);
