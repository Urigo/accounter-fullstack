// returns the database URL
// This is a script used for later setting DATABASE_URL environment variable for the PgTyped dependency.

/* eslint-disable @typescript-eslint/no-require-imports */
// `quiet` keeps dotenv off this script's stdout, which the caller captures as DATABASE_URL.
require('dotenv').config({ path: ['.env', '../../.env'], quiet: true });

const {
  POSTGRES_USER = 'postgres',
  POSTGRES_PASSWORD = 'postgres',
  POSTGRES_HOST = 'localhost',
  POSTGRES_PORT = 5432,
  POSTGRES_DB = 'accounter',
  POSTGRES_SSL = null,
} = process.env;

const dbUrl = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}${
  POSTGRES_SSL === '1' ? '?sslmode=require' : '?sslmode=disable'
}`;

// eslint-disable-next-line no-console
console.log(dbUrl);
