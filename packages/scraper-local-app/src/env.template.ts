import type { Config } from './index.js';

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
