import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;
import { init } from 'modern-poalim-scraper';
import lodash from 'lodash';
const { camelCase, upperFirst } = lodash;

import { saveTransactionsToDB } from './data/saveTransactionsToDB';
import { getCurrencyRates } from './data/currency';
import { isBefore, subYears, addMonths, startOfMonth } from 'date-fns'; // TODO: Use Temporal with polyfill instead

function getTransactionsFromCards(CardsTransactionsListBean: any) {
  let allData: any = [];
  CardsTransactionsListBean.cardNumberList.forEach(
    (cardInformation: any, index: any) => {
      const txnGroups =
        CardsTransactionsListBean[`Index${index}`].CurrentCardTransactions;
      if (txnGroups) {
        txnGroups.forEach((txnGroup: any) => {
          if (txnGroup.txnIsrael) {
            let israelTransactions = txnGroup.txnIsrael.map(
              (transaction: any) => ({
                ...transaction,
                card: cardInformation.slice(cardInformation.length - 4),
              })
            );
            allData.push(...israelTransactions);
          }
          if (txnGroup.txnAbroad) {
            let abroadTransactions = txnGroup.txnAbroad.map(
              (transaction: any) => ({
                ...transaction,
                card: cardInformation.slice(cardInformation.length - 4),
              })
            );
            allData.push(...abroadTransactions);
          }
        });
      }
    }
  );

  return allData;
}

// TODO: Remove all any
async function getILSfromBankAndSave(
  newScraperIstance: any,
  account: any,
  pool: pg.Pool
) {
  let ILSTransactions = await newScraperIstance.getILSTransactions(account);
  console.log(
    `finished getting ILSTransactions ${ILSTransactions.data.retrievalTransactionData.bankNumber}:${ILSTransactions.data.retrievalTransactionData.branchNumber}:${ILSTransactions.data.retrievalTransactionData.accountNumber}`,
    ILSTransactions.isValid
  );
  if (!ILSTransactions.isValid) {
    console.log(ILSTransactions.errors);
  }

  if (
    ILSTransactions.data.retrievalTransactionData.accountNumber != 410915 &&
    ILSTransactions.data.retrievalTransactionData.accountNumber != 61066 &&
    ILSTransactions.data.retrievalTransactionData.accountNumber != 466803
  ) {
    console.error(`UNKNOWN ACCOUNT 
      ${ILSTransactions.data.retrievalTransactionData.bankNumber}
      ${ILSTransactions.data.retrievalTransactionData.branchNumber}
      ${ILSTransactions.data.retrievalTransactionData.accountNumber}
    `);
  } else {
    console.log(
      `Saving ILS for ${ILSTransactions.data.retrievalTransactionData.bankNumber}:${ILSTransactions.data.retrievalTransactionData.branchNumber}:${ILSTransactions.data.retrievalTransactionData.accountNumber}`
    );
    await saveTransactionsToDB(
      ILSTransactions.data.transactions,
      'ils',
      {
        accountNumber:
          ILSTransactions.data.retrievalTransactionData.accountNumber,
        branchNumber:
          ILSTransactions.data.retrievalTransactionData.branchNumber,
        bankNumber: ILSTransactions.data.retrievalTransactionData.bankNumber,
      },
      pool
    );
    console.log(
      `Saved ILS for ${ILSTransactions.data.retrievalTransactionData.bankNumber}:${ILSTransactions.data.retrievalTransactionData.branchNumber}:${ILSTransactions.data.retrievalTransactionData.accountNumber}`
    );

    const date = new Date();
    const dateString = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    )
      .toISOString()
      .split('T')[0];

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
  newScraperIstance: any,
  account: any,
  pool: pg.Pool
) {
  let foreignTransactions = await newScraperIstance.getForeignTransactions(
    account
  );
  console.log(
    `finished getting foreignTransactions ${account.accountNumber}`,
    foreignTransactions.isValid
  );
  if (!foreignTransactions.isValid) {
    console.log(foreignTransactions.errors);
  }

  await Promise.all(
    foreignTransactions.data.balancesAndLimitsDataList.map(
      async (foreignAccountsArray: any) => {
        let accountCurrency: 'usd' | 'eur' | undefined;
        switch (foreignAccountsArray.currencyCode) {
          case 19:
            accountCurrency = 'usd';
            break;
          case 100:
            accountCurrency = 'eur';
            break;
          default:
            // TODO: Log important checks
            console.error(
              'New account currency - ',
              foreignAccountsArray.currencyCode
            );
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
      }
    )
  );
}

async function getBankData(pool: pg.Pool, scraper: any) {
  console.log('start getBankData');
  console.log('Bank Login');
  let newPoalimInstance = await scraper.hapoalim(
    {
      userCode: process.env.USER_CODE,
      password: process.env.PASSWORD,
    },
    {
      validateSchema: true,
      isBusiness: true,
    }
  );
  console.log('getting accounts');
  let accounts = await newPoalimInstance.getAccountsData();
  console.log('finished getting accounts', accounts.isValid);
  if (!accounts.isValid) {
    console.log(accounts.errors);
  }
  await Promise.all(
    accounts.data.map(async (account: any) => {
      console.log(
        `Getting ILS, Foreign and deposits for ${account.accountNumber}`
      );
      const results = await Promise.allSettled([
        getILSfromBankAndSave(newPoalimInstance, account, pool),
        getForeignTransactionsfromBankAndSave(newPoalimInstance, account, pool),
        getDepositsAndSave(newPoalimInstance, account, pool),
      ]);
      console.log(
        `got and saved ILS and Foreign for ${
          account.accountNumber
        } - ${JSON.stringify(results)}`
      );
    })
  );
  console.log('finish iterating over bank accounts');
  // await newScraper.close();
  // console.log('closed');
}

async function getDepositsAndSave(
  newScraperIstance: any,
  account: any,
  pool: pg.Pool
) {
  console.log('getting deposits');
  let deposits = await newScraperIstance.getDeposits(account);
  console.log(
    `finished getting deposits ${account.accountNumber}`,
    deposits.isValid
  );
  if (!deposits.isValid) {
    console.log(deposits.errors);
  }

  if (
    account.accountNumber != 410915 &&
    account.accountNumber != 61066 &&
    account.accountNumber != 466803
  ) {
    console.error('UNKNOWN ACCOUNT ', account.accountNumber);
  } else {
    console.log(`Saving deposits for ${account.accountNumber}`);
    if (deposits.data.list.length != 1) {
      console.log('WRONG NUMBER OF DEPOSITS', deposits.data.list);
    } else {
      delete deposits.data.list[0].messages;

      if (deposits.data.list[0].data.length != 1) {
        console.log('Deposit internal array arong', deposits.data);
      } else {
        delete deposits.data.list[0].data[0].metadata;

        const internalArrayKeys = Object.keys(deposits.data.list[0].data[0]);

        for (const key of internalArrayKeys) {
          let pascalKey = camelCase(key);
          pascalKey = upperFirst(pascalKey);
          deposits.data.list[0][`data0${pascalKey}`] =
            deposits.data.list[0].data[0][key];
        }
        delete deposits.data.list[0].data;

        await saveTransactionsToDB(
          [deposits.data.list[0]],
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
  newIsracardInstance: any,
  id: any
) {
  console.log(
    `Getting from isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`
  );
  const monthTransactions = await newIsracardInstance.getMonthTransactions(
    month
  );
  console.log(monthTransactions.isValid);
  if (!monthTransactions.isValid) {
    console.log(monthTransactions.errors);
  }
  if (monthTransactions?.data?.Header?.Status != '1') {
    console.log(JSON.stringify(monthTransactions.data?.Header));
  }
  let allData = getTransactionsFromCards(
    monthTransactions.data.CardsTransactionsListBean
  );

  const wantedCreditCards = ['1082', '2733', '9217', '6264', '1074', '17 *'];
  const onlyWantedCreditCardsTransactions = allData.filter((transaction: any) =>
    wantedCreditCards.includes(transaction.card)
  );

  if (onlyWantedCreditCardsTransactions.length > 0) {
    console.log(
      `saving isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`
    );
    await saveTransactionsToDB(
      onlyWantedCreditCardsTransactions,
      'isracard',
      null,
      pool
    );
    console.log(
      `finished saving isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`
    );
  }
}

async function getCreditCardData(
  pool: pg.Pool,
  scraper: any,
  credentials: any
) {
  console.log('start getCreditCardData');
  console.log('Creditcard Login');
  let newIsracardInstance = await scraper.isracard(
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
  let lastMonthToFetch = addMonths(startOfMonth(new Date()), 2);

  while (isBefore(monthToFetch, lastMonthToFetch)) {
    allMonthsToFetch.push(monthToFetch);
    monthToFetch = addMonths(monthToFetch, 1);
  }

  const results = await Promise.allSettled(
    allMonthsToFetch.map(async (currentMonthToFetch) => {
      await getCreditCardTransactionsAndSave(
        currentMonthToFetch,
        pool,
        newIsracardInstance,
        credentials.ID
      );
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
  let newScraperIstance = await init();
  let secondScraperIstance = await init();
  let thirdScraperIstance = await init();
  console.log('After Init scraper');
  const results = await Promise.allSettled([
    getCreditCardData(pool, newScraperIstance, {
      ID: process.env.ISRACARD_ID,
      password: process.env.ISRACARD_PASSWORD,
      card6Digits: process.env.ISRACARD_6_DIGITS,
    }),
    getCreditCardData(pool, thirdScraperIstance, {
      ID: process.env.DOTAN_ISRACARD_ID,
      password: process.env.DOTAN_ISRACARD_PASSWORD,
      card6Digits: process.env.DOTAN_ISRACARD_6_DIGITS,
    }),
    getBankData(pool, secondScraperIstance),
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
