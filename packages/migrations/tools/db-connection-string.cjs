// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({
  path: '../../.env',
});

const {
  POSTGRES_USER = 'postgres',
  POSTGRES_PASSWORD = 'postgres',
  POSTGRES_HOST = 'localhost',
  POSTGRES_PORT = 5432,
  POSTGRES_DB = 'accounter',
  POSTGRES_SSL = null,
} = process.env;

function cn(dbName = POSTGRES_DB) {
  const sslRaw = String(POSTGRES_SSL ?? '')
    .trim()
    .toLowerCase();
  const useSsl = sslRaw === '1' || sslRaw === 'true' || sslRaw === 'require';
  return {
    host: POSTGRES_HOST,
    port: Number(POSTGRES_PORT),
    database: dbName,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}
module.exports = cn;
