import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;
import { init } from 'modern-poalim-scraper';
import lodash from 'lodash';
const { camelCase, upperFirst } = lodash;
import { saveTransactionsToDB } from './data/save-transactions-to-db';
import { getCurrencyRates } from './data/currency';
import { isBefore, subYears, addMonths, startOfMonth } from 'date-fns'; // TODO: Use Temporal with polyfill instead
import { AccountDataSchema } from 'modern-poalim-scraper/dist/generatedTypes/accountDataSchema';
import { Deposits, HapoalimDepositsSchema } from 'modern-poalim-scraper/dist/generatedTypes/hapoalimDepositsSchema';
import { ILSCheckingTransactionsDataSchema } from 'modern-poalim-scraper/dist/generatedTypes/ILSCheckingTransactionsDataSchema';
import { ForeignTransactionsBusinessSchema } from 'modern-poalim-scraper/dist/generatedTypes/foreignTransactionsBusinessSchema';
import {
  Index,
  IsracardCardsTransactionsList,
} from 'modern-poalim-scraper/dist/generatedTypes/isracardCardsTransactionsList';

type Scraper = Awaited<ReturnType<typeof init>>;
type HapoalimScraper = Awaited<ReturnType<Scraper['hapoalim']>>;
type IsracardScraper = Awaited<ReturnType<Scraper['isracard']>>;
export type DecoratedDeposit = Omit<Deposits[0], 'messages' | 'data'> & {
  messages?: Deposits[0]['messages'];
  data?: (Omit<Deposits[0]['data'][0], 'metadata'> & {
    metadata?: Deposits[0]['data'][0]['metadata'];
  })[];
  [key: `data0${string}`]: any;
};
export type CardTransaction = (
  | NonNullable<
      IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][0]['txnIsrael']
    >[0]
  | NonNullable<
      IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][0]['txnAbroad']
    >[0]
) & { card: string };

function getTransactionsFromCards(
  CardsTransactionsListBean?: IsracardCardsTransactionsList['CardsTransactionsListBean']
) {
  const allData: CardTransaction[] = [];
  if (CardsTransactionsListBean) {
    CardsTransactionsListBean.cardNumberList.forEach((cardInformation, index) => {
      const txnGroups = (
        CardsTransactionsListBean[
          `Index${index}` as keyof IsracardCardsTransactionsList['CardsTransactionsListBean']
        ] as Index
      )?.CurrentCardTransactions;
      if (txnGroups) {
        txnGroups.forEach(txnGroup => {
          if (txnGroup.txnIsrael) {
            const israelTransactions = txnGroup.txnIsrael.map(transaction => ({
              ...transaction,
              card: cardInformation.slice(cardInformation.length - 4),
            }));
            allData.push(...israelTransactions);
          }
          if (txnGroup.txnAbroad) {
            const abroadTransactions = txnGroup.txnAbroad.map(transaction => ({
              ...transaction,
              card: cardInformation.slice(cardInformation.length - 4),
            }));
            allData.push(...abroadTransactions);
          }
        });
      }
    });
  }

  return allData;
}

// TODO: Remove all any
async function getILSfromBankAndSave(newScraperIstance: HapoalimScraper, account: AccountDataSchema[0], pool: pg.Pool) {
  if (newScraperIstance === 'Unknown Error') {
    console.log('getILSfromBankAndSave: No scraper');
    return;
  }
  const ILSTransactions = (await newScraperIstance.getILSTransactions(account)) as {
    isValid: boolean;
    errors: unknown;
    data: ILSCheckingTransactionsDataSchema | null;
  };
  console.log(
    `finished getting ILSTransactions ${ILSTransactions.data?.retrievalTransactionData.bankNumber}:${ILSTransactions.data?.retrievalTransactionData.branchNumber}:${ILSTransactions.data?.retrievalTransactionData.accountNumber}`,
    ILSTransactions.isValid
  );
  if (!ILSTransactions.isValid) {
    console.log(
      `newScraperIstance.getILSTransactions ${JSON.stringify(account.accountNumber)} schema error: `,
      ILSTransactions.errors
    );
  }

  if (
    ILSTransactions.data?.retrievalTransactionData.accountNumber != 410915 &&
    ILSTransactions.data?.retrievalTransactionData.accountNumber != 61066 &&
    ILSTransactions.data?.retrievalTransactionData.accountNumber != 466803 &&
    ILSTransactions.data?.retrievalTransactionData.accountNumber != 362396
  ) {
    console.error(`UNKNOWN ACCOUNT 
      ${ILSTransactions.data?.retrievalTransactionData.bankNumber}
      ${ILSTransactions.data?.retrievalTransactionData.branchNumber}
      ${ILSTransactions.data?.retrievalTransactionData.accountNumber}
    `);
  } else {
    console.log(
      `Saving ILS for ${ILSTransactions.data.retrievalTransactionData.bankNumber}:${ILSTransactions.data.retrievalTransactionData.branchNumber}:${ILSTransactions.data.retrievalTransactionData.accountNumber}`
    );
    await saveTransactionsToDB(
      ILSTransactions.data.transactions,
      'ils',
      {
        accountNumber: ILSTransactions.data.retrievalTransactionData.accountNumber,
        branchNumber: ILSTransactions.data.retrievalTransactionData.branchNumber,
        bankNumber: ILSTransactions.data.retrievalTransactionData.bankNumber,
      },
      pool
    );
    console.log(
      `Saved ILS for ${ILSTransactions.data.retrievalTransactionData.bankNumber}:${ILSTransactions.data.retrievalTransactionData.branchNumber}:${ILSTransactions.data.retrievalTransactionData.accountNumber}`
    );

    const date = new Date();
    const dateString = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    fs.writeFile(
      `../archived_data/POALIM_original_checking_bank_dump_${dateString}_${account.accountNumber}.json`,
      JSON.stringify(ILSTransactions),
      'utf8',
      () => {
        console.log('done dumping original checking dump file');
      }
    );
  }
}

async function getForeignTransactionsfromBankAndSave(
  newScraperIstance: HapoalimScraper,
  account: AccountDataSchema[0],
  pool: pg.Pool
) {
  if (newScraperIstance === 'Unknown Error') {
    console.log('getForeignTransactionsfromBankAndSave: No scraper');
    return;
  }
  const foreignTransactions = (await newScraperIstance.getForeignTransactions(account)) as {
    isValid: boolean;
    errors: unknown;
    data: ForeignTransactionsBusinessSchema | null;
  };
  console.log(`finished getting foreignTransactions ${account.accountNumber}`, foreignTransactions.isValid);
  if (!foreignTransactions.isValid) {
    console.log(
      `getForeignTransactions ${JSON.stringify(account.accountNumber)} schema error: `,
      foreignTransactions.errors
    );
  }

  if (foreignTransactions.data) {
    await Promise.all(
      foreignTransactions.data.balancesAndLimitsDataList.map(async foreignAccountsArray => {
        let accountCurrency: 'usd' | 'eur' | 'gbp' | undefined;
        switch (foreignAccountsArray.currencyCode) {
          case 19:
            accountCurrency = 'usd';
            break;
          case 100:
            accountCurrency = 'eur';
            break;
          case 27:
            accountCurrency = 'gbp';
            break;
          default:
            // TODO: Log important checks
            console.error('New account currency - ', foreignAccountsArray.currencyCode);
            break;
        }
        if (accountCurrency) {
          console.log(
            `Saving Foreign for ${foreignAccountsArray.bankNumber}:${foreignAccountsArray.branchNumber}:${foreignAccountsArray.accountNumber} currency ${accountCurrency}`
          );
          await saveTransactionsToDB(
            foreignAccountsArray.transactions,
            accountCurrency,
            {
              accountNumber: foreignAccountsArray.accountNumber,
              branchNumber: foreignAccountsArray.branchNumber,
              bankNumber: foreignAccountsArray.bankNumber,
            },
            pool
          );
          console.log(
            `Saved Foreign for ${foreignAccountsArray.bankNumber}:${foreignAccountsArray.branchNumber}:${foreignAccountsArray.accountNumber} currency ${accountCurrency}`
          );
        }
      })
    );
  }
}

async function getBankData(pool: pg.Pool, scraper: Scraper) {
  console.log('start getBankData');
  console.log('Bank Login');
  const newPoalimInstance = await scraper.hapoalim(
    {
      userCode: process.env.USER_CODE as string,
      password: process.env.PASSWORD as string,
    },
    {
      validateSchema: true,
      isBusiness: false,
    }
  );
  console.log('getting accounts');
  const accounts =
    newPoalimInstance === 'Unknown Error'
      ? { isValid: false, errors: '', data: null }
      : ((await newPoalimInstance.getAccountsData()) as {
          isValid: boolean;
          errors: unknown;
          data: AccountDataSchema | null;
        });
  console.log('finished getting accounts', accounts.isValid);
  if (!accounts.isValid) {
    console.log(`getAccountsData Poalim schema errors: `, accounts.errors);
  }
  const tableName = 'financial_accounts';
  for (const account of accounts.data ?? []) {
    /* check if account exists */
    let whereClause = `
    SELECT * FROM ${`accounter_schema.` + tableName}
    WHERE 
    `;

    const columnNamesResult = await pool.query(`
      SELECT * 
      FROM information_schema.columns
      WHERE table_schema = 'accounter_schema'
      AND table_name = '${tableName}';
    `);

    const columnNamesToExcludeFromComparison = [
      'privateBusiness',
      'owner',
      'hashavshevetAccountIls',
      'hashavshevetAccountUsd',
      'hashavshevetAccountEur',
      'hashavshevetAccountEur',
      'hashavshevetAccountGbp',
      'metegDoarNet',
      'id',
    ];
    if (account.accountUpdateDate == 0) {
      columnNamesToExcludeFromComparison.push('accountUpdateDate');
    }

    for (const dBcolumn of columnNamesResult.rows) {
      const camelCaseColumnName = camelCase(dBcolumn.column_name) as keyof typeof account;
      if (!columnNamesToExcludeFromComparison.includes(camelCaseColumnName)) {
        let actualCondition = '';
        const isNotNull = typeof account[camelCaseColumnName] !== 'undefined' && account[camelCaseColumnName] != null;

        whereClause = whereClause.concat('  ' + dBcolumn.column_name);

        if (
          dBcolumn.data_type == 'character varying' ||
          dBcolumn.data_type == 'USER-DEFINED' ||
          dBcolumn.data_type == 'text'
        ) {
          if (isNotNull && (camelCaseColumnName as string) != 'beneficiaryDetailsData') {
            actualCondition = `= $$` + account[camelCaseColumnName] + `$$`;
          }
        } else if (dBcolumn.data_type == 'date' || dBcolumn.data_type == 'bit') {
          actualCondition = `= '` + account[camelCaseColumnName] + `'`;
          // if (dBcolumn.data_type == 'bit') {
          //   console.log('bit - ', actualCondition);
          //   console.log(transaction.eventAmount)
          // }
        } else if (
          dBcolumn.data_type == 'integer' ||
          dBcolumn.data_type == 'numeric' ||
          dBcolumn.data_type == 'bigint'
        ) {
          actualCondition = `= ` + account[camelCaseColumnName];
        } else if (isNotNull && dBcolumn.data_type == 'json') {
          const inner = account[camelCaseColumnName];
          const firstKey = Object.keys(account[camelCaseColumnName])[0] as keyof typeof inner;
          actualCondition = `->> '` + firstKey + `' = '` + account[camelCaseColumnName][firstKey] + `'`;
          if (Object.keys(account[camelCaseColumnName]).length > 1) {
            // TODO: Log important checks
            console.log('more keys in json!', Object.keys(account[camelCaseColumnName]));
          }
        } else if (isNotNull || dBcolumn.data_type != 'json') {
          // TODO: Log important checks
          console.log('unknown type ' + dBcolumn.data_type + ' ' + camelCaseColumnName);
        }

        whereClause = whereClause.concat(
          ` ${isNotNull ? actualCondition : 'IS NULL'} AND
             `
        );
      }
    }

    const lastIndexOfAND = whereClause.lastIndexOf('AND');
    whereClause = whereClause.substring(0, lastIndexOfAND);

    try {
      const res = await pool.query(whereClause);

      /* add new accounts */
      if (res.rowCount > 0) {
        // console.log('found');
      } else {
        console.log('Account not found!!');

        let columnNames = columnNamesResult.rows.map((column: { column_name: string }) => column.column_name);

        columnNames = columnNames.filter((columnName: string) => columnName != 'id');
        let text = `INSERT INTO accounter_schema.${tableName}
        (
          ${columnNames.map(x => x).join(', ')},
        )`;
        const lastIndexOfComma = text.lastIndexOf(',');
        text = text.substring(0, lastIndexOfComma).concat(text.substring(lastIndexOfComma + 1, text.length));

        const arrayKeys = columnNames.keys();
        let denseKeys = [...arrayKeys];
        denseKeys = denseKeys.map(x => x + 1);
        const keysOfInputs = denseKeys.join(', $');
        text = text.concat(` VALUES($${keysOfInputs}) RETURNING *`);

        const values = [
          account.accountNumber,
          'business',
          null,
          null,
          null,
          null,
          account.bankNumber,
          account.branchNumber,
          account.extendedBankNumber,
          account.partyPreferredIndication,
          account.partyAccountInvolvementCode,
          account.accountDealDate,
          account.accountUpdateDate,
          account.metegDoarNet,
          account.kodHarshaatPeilut,
          account.accountClosingReasonCode,
          account.accountAgreementOpeningDate,
          account.serviceAuthorizationDesc,
          account.branchTypeCode,
          account.mymailEntitlementSwitch,
          null,
        ];

        const res = await pool.query(text, values);
        console.log(res);
      }
    } catch (error) {
      console.log('Accounts pg error - ', error);
    }
  }

  /* fetch account data */
  await Promise.all(
    (accounts.data ?? []).map(async account => {
      console.log(`Getting ILS, Foreign and deposits for ${account.accountNumber}`);
      const results = await Promise.allSettled([
        getILSfromBankAndSave(newPoalimInstance, account, pool),
        getForeignTransactionsfromBankAndSave(newPoalimInstance, account, pool),
        getDepositsAndSave(newPoalimInstance, account, pool),
      ]);
      console.log(`got and saved ILS and Foreign for ${account.accountNumber} - ${JSON.stringify(results)}`);
    })
  );
  console.log('finish iterating over bank accounts');
  // await newScraper.close();
  // console.log('closed');
}

async function getDepositsAndSave(newScraperIstance: HapoalimScraper, account: AccountDataSchema[0], pool: pg.Pool) {
  if (newScraperIstance === 'Unknown Error') {
    console.log('getDepositsAndSave: No scraper');
    return;
  }
  console.log('getting deposits');
  const deposits = (await newScraperIstance.getDeposits(account)) as {
    isValid: boolean;
    errors: unknown;
    data: HapoalimDepositsSchema | null;
  };
  console.log(`finished getting deposits ${account.accountNumber}`, deposits.isValid);
  if (!deposits.isValid) {
    console.log(`getDeposits ${JSON.stringify(account.accountNumber)} schema errors: `, deposits.errors);
  }

  if (account.accountNumber != 410915 && account.accountNumber != 61066 && account.accountNumber != 466803) {
    console.error('UNKNOWN ACCOUNT ', account.accountNumber);
  } else {
    console.log(`Saving deposits for ${account.accountNumber}`);
    if (deposits.data?.list.length != 1) {
      console.log('WRONG NUMBER OF DEPOSITS', deposits.data?.list);
    } else {
      const deposit: DecoratedDeposit = deposits.data.list[0];
      delete deposit.messages;

      if (deposit.data?.length != 1) {
        console.log('Deposit internal array arong', deposits.data);
      } else {
        delete deposit.data[0].metadata;

        const internalArrayKeys = Object.keys(deposit.data[0]);

        for (const key of internalArrayKeys) {
          let pascalKey = camelCase(key);
          pascalKey = upperFirst(pascalKey);
          deposit[`data0${pascalKey}`] = deposit.data[0][key as keyof typeof deposit.data[0]];
        }
        delete deposit.data;

        await saveTransactionsToDB(
          [deposit],
          'deposits',
          {
            accountNumber: account.accountNumber,
            branchNumber: account.branchNumber,
            bankNumber: account.bankNumber,
          },
          pool
        );
      }
    }
    console.log(`Saved deposits for ${account.accountNumber}`);
  }
}

async function getCreditCardTransactionsAndSave(
  month: Date,
  pool: pg.Pool,
  newIsracardInstance: IsracardScraper,
  id: string
) {
  console.log(`Getting from isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`);
  const monthTransactions = (await newIsracardInstance.getMonthTransactions(month)) as {
    isValid: boolean;
    errors: unknown;
    data: IsracardCardsTransactionsList | null;
  };
  console.log(monthTransactions.isValid);
  if (!monthTransactions.isValid) {
    console.log(
      `newIsracardInstance.getMonthTransactions ${JSON.stringify(id)} schema error: `,
      monthTransactions.errors
    );
  }
  if (monthTransactions?.data?.Header?.Status != '1') {
    console.error(`Replace password for creditcard ${id}`);
    console.log(JSON.stringify(monthTransactions.data?.Header));
  }
  const allData = getTransactionsFromCards(monthTransactions.data?.CardsTransactionsListBean);

  const wantedCreditCards = ['1082', '2733', '9217', '6264', '1074', '17 *'];
  const onlyWantedCreditCardsTransactions = allData.filter(transaction => wantedCreditCards.includes(transaction.card));

  if (onlyWantedCreditCardsTransactions.length > 0) {
    console.log(`saving isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`);
    await saveTransactionsToDB(onlyWantedCreditCardsTransactions, 'isracard', null, pool);
    console.log(`finished saving isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`);
  }
}

async function getCreditCardData(
  pool: pg.Pool,
  scraper: Scraper,
  credentials: {
    ID: string;
    password: string;
    card6Digits: string;
  }
) {
  console.log('start getCreditCardData');
  console.log('Creditcard Login');
  const newIsracardInstance = await scraper.isracard(
    {
      ID: credentials.ID,
      password: credentials.password,
      card6Digits: credentials.card6Digits,
    },
    {
      validateSchema: true,
    }
  );

  let monthToFetch = subYears(new Date(), 2);
  const allMonthsToFetch = [];
  const lastMonthToFetch = addMonths(startOfMonth(new Date()), 2);

  while (isBefore(monthToFetch, lastMonthToFetch)) {
    allMonthsToFetch.push(monthToFetch);
    monthToFetch = addMonths(monthToFetch, 1);
  }

  await Promise.allSettled(
    allMonthsToFetch.map(async currentMonthToFetch => {
      await getCreditCardTransactionsAndSave(currentMonthToFetch, pool, newIsracardInstance, credentials.ID);
    })
  );
  console.log(`after all creditcard months - ${credentials.ID}`);
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  console.log('Init scraper');
  const newScraperInstance = await init();
  const secondScraperInstance = await init();
  const thirdScraperInstance = await init();
  console.log('After Init scraper');
  await Promise.allSettled([
    getCreditCardData(pool, newScraperInstance, {
      ID: process.env.ISRACARD_ID as string,
      password: process.env.ISRACARD_PASSWORD as string,
      card6Digits: process.env.ISRACARD_6_DIGITS as string,
    }),
    getCreditCardData(pool, thirdScraperInstance, {
      ID: process.env.DOTAN_ISRACARD_ID as string,
      password: process.env.DOTAN_ISRACARD_PASSWORD as string,
      card6Digits: process.env.DOTAN_ISRACARD_6_DIGITS as string,
    }),
    getBankData(pool, secondScraperInstance),
    getCurrencyRates(pool),
  ]);
  console.log('after all');

  // await compareHashavshevetToDB(pool),
  //   console.log('after compareHashavshevetToDB');

  // console.log('syncHashavshevetBankPages');
  // await syncHashavshevetBankPages(pool);

  console.log('ending pool');
  pool.end();
})();
