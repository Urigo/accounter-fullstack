import { config as dotenv } from 'dotenv';
import type { Config } from './index.js';

dotenv({ path: '../../.env', quiet: true });

export const guildConfig: Config = {
  showBrowser: false,
  concurrentScraping: false,
  database: {
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL ? true : false,
  },
  fetchBankOfIsraelRates: true,
  poalimAccounts: [
    {
      nickname: 'Main',
      userCode: process.env.USER_CODE!,
      password: process.env.PASSWORD!,
      options: {
        isBusinessAccount: true,
        acceptedAccountNumbers: [
          // 410_915, // This is a private account, not business
          // 61_066, // This is the previous company's account
          466_803, 590_830,
        ],
        // createDumpFile: true,
      },
    },
  ],
  isracardAccounts: [
    {
      nickname: 'Dotan',
      ownerId: process.env.DOTAN_ISRACARD_ID!,
      password: process.env.DOTAN_ISRACARD_PASSWORD!,
      last6Digits: process.env.DOTAN_ISRACARD_6_DIGITS!,
      options: {
        acceptedCardNumbers: ['5972'],
      },
    },
    {
      nickname: 'Uri',
      ownerId: process.env.ISRACARD_ID!,
      password: process.env.ISRACARD_PASSWORD!,
      last6Digits: process.env.ISRACARD_6_DIGITS!,
      options: {
        acceptedCardNumbers: [
          '1082',
          // '6264', // These are private cards, not business
          // '6317', // These are private cards, not business
        ],
      },
    },
  ],
};

const personalConfig: Config = {
  showBrowser: false,
  concurrentScraping: false,
  database: {
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL ? true : false,
  },
  fetchBankOfIsraelRates: false,
  poalimAccounts: [
    {
      nickname: 'Main',
      userCode: process.env.USER_CODE!,
      password: process.env.PASSWORD!,
      options: {
        isBusinessAccount: false,
        acceptedAccountNumbers: [262_752],
        acceptedBranchNumbers: [559],
      },
    },
  ],
  // isracardAccounts: [
  //   {
  //     nickname: 'noy-mscard',
  //     ownerId: process.env.DOTAN_ISRACARD_ID!,
  //     password: process.env.DOTAN_ISRACARD_PASSWORD!,
  //     last6Digits: process.env.DOTAN_ISRACARD_6_DIGITS!,
  //   },
  //   {
  //     nickname: 'gil-mscard',
  //     ownerId: process.env.ISRACARD_ID!,
  //     password: process.env.ISRACARD_PASSWORD!,
  //     last6Digits: process.env.ISRACARD_6_DIGITS!,
  //     options: {
  //       acceptedCardNumbers: ['6646', '7086', '6154'],
  //     },
  //   },
  // ],
  // amexAccounts: [
  //   {
  //     nickname: 'noy-amex',
  //     ownerId: process.env.AMEX_ID!,
  //     password: process.env.AMEX_PASSWORD!,
  //     last6Digits: process.env.AMEX_6_DIGITS!,
  //   },
  // ],
  // maxAccounts: [
  //   {
  //     nickname: 'gil-max',
  //     username: process.env.MAX_USERNAME!,
  //     password: process.env.MAX_PASSWORD!,
  //   },
  // ],
};

export const config = process.env.PERSONAL_CONFIG ? personalConfig : guildConfig;
