import { config as dotenv } from 'dotenv';
import type { Config } from './index.js';

dotenv({ path: '../../.env' });

export const config: Config = {
  database: {
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 5432,
    database: process.env.POSTGRES_DB ?? 'accounter',
    ssl: process.env.POSTGRES_SSL ? true : false,
  },
  poalimAccounts: [],
  isracardAccounts: [],
  amexAccounts: [],
  // Example usage:
  // calAccounts: [
  //   {
  //     username: '',
  //     password: '',
  //     last4Digits: '',
  //   },
  // ],
  // discountAccounts: [
  //   {
  //     ID: '',
  //     password: '',
  //     code: '',
  //     nickname: '',
  //   },
  // ],
};
