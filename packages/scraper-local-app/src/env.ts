import { config as dotenv } from 'dotenv';
import type { Config } from './index.js';

dotenv({
  path: '../../.env',
});

export const config: Config = {
  database: {
    user: 'postgres',
    password: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'accounter',
    ssl: false,
  },
  showBrowser: false,
  poalimAccounts: [],
  isracardAccounts: [],
  amexAccounts: [],
};
