import * as fs from 'fs';
import { addMonths, isBefore, startOfMonth, subYears } from 'date-fns';
import dotenv from 'dotenv';
import lodash from 'lodash';
import pg from 'pg';
import { init } from '@accounter/modern-poalim-scraper';
import type { IsracardCardsTransactionsList } from '../../modern-poalim-scraper/src/__generated__/isracardCardsTransactionsList.js';
import type { isracardCredentials } from '../../modern-poalim-scraper/src/scrapers/isracard.js';
import { getCurrencyRates } from './data/currency.js';
import { saveTransactionsToDB } from './data/save-transactions-to-db.js';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

const { camelCase, upperFirst } = lodash;

// TODO: Use Temporal with polyfill instead

type IsraelTransaction = NonNullable<
  IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][number]['txnIsrael']
>[number];
type ForeignTransaction = NonNullable<
  IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][number]['txnAbroad']
>[number];
export type DecoratedTransaction = (IsraelTransaction | ForeignTransaction) & { card: string };

function getTransactionsFromCards(
  cardsTransactionsListBean: IsracardCardsTransactionsList['CardsTransactionsListBean'],
): Array<DecoratedTransaction> {
  const allData: Array<DecoratedTransaction> = [];
  cardsTransactionsListBean.cardNumberList.forEach((cardInformation, index: number) => {
    const transactionsGroups =
      cardsTransactionsListBean[`Index${index}` as 'Index0'].CurrentCardTransactions;
    if (transactionsGroups) {
      transactionsGroups.forEach(txnGroup => {
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

  return allData;
}

// TODO: Remove all any
async function getILSfromBankAndSave(
  newScraperIstance: PoalimScraper,
  account: Parameters<PoalimScraper['getILSTransactions']>[0],
  pool: pg.Pool,
) {
  const ILSTransactions = await newScraperIstance.getILSTransactions(account);

  if (!ILSTransactions.data) {
    console.log(
      `No ILS data for ${account.bankNumber}:${account.branchNumber}:${account.accountNumber}`,
    );
    return;
  }

  console.log(
    `finished getting ILSTransactions ${ILSTransactions.data.retrievalTransactionData.bankNumber}:${ILSTransactions.data.retrievalTransactionData.branchNumber}:${ILSTransactions.data.retrievalTransactionData.accountNumber}`,
    ILSTransactions.isValid,
  );
  if (!ILSTransactions.isValid) {
    console.log(
      `newScraperIstance.getILSTransactions ${JSON.stringify(
        account.accountNumber,
      )} schema error: `,
      'errors' in ILSTransactions ? ILSTransactions.errors : null,
    );
  }

  if (
    ILSTransactions.data.retrievalTransactionData.accountNumber != 410915 &&
    ILSTransactions.data.retrievalTransactionData.accountNumber != 61066 &&
    ILSTransactions.data.retrievalTransactionData.accountNumber != 466803 &&
    ILSTransactions.data.retrievalTransactionData.accountNumber != 362396 &&
    ILSTransactions.data.retrievalTransactionData.accountNumber != 667871
  ) {
    console.error(`UNKNOWN ACCOUNT 
      ${ILSTransactions.data.retrievalTransactionData.bankNumber}
      ${ILSTransactions.data.retrievalTransactionData.branchNumber}
      ${ILSTransactions.data.retrievalTransactionData.accountNumber}
    `);
  } else {
    console.log(
      `Saving ILS for ${ILSTransactions.data.retrievalTransactionData.bankNumber}:${ILSTransactions.data.retrievalTransactionData.branchNumber}:${ILSTransactions.data.retrievalTransactionData.accountNumber}`,
    );
    await saveTransactionsToDB(
      ILSTransactions.data.transactions,
      'ils',
      {
        accountNumber: ILSTransactions.data.retrievalTransactionData.accountNumber,
        branchNumber: ILSTransactions.data.retrievalTransactionData.branchNumber,
        bankNumber: ILSTransactions.data.retrievalTransactionData.bankNumber,
      },
      pool,
    );
    console.log(
      `Saved ILS for ${ILSTransactions.data.retrievalTransactionData.bankNumber}:${ILSTransactions.data.retrievalTransactionData.branchNumber}:${ILSTransactions.data.retrievalTransactionData.accountNumber}`,
    );

    const date = new Date();
    const dateString = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];

    fs.writeFile(
      `../archived_data/POALIM_original_checking_bank_dump_${dateString}_${account.accountNumber}.json`,
      JSON.stringify(ILSTransactions),
      'utf8',
      () => {
        console.log('done dumping original checking dump file');
      },
    );
  }
}

async function getForeignTransactionsfromBankAndSave(
  newScraperIstance: PoalimScraper,
  account: Parameters<PoalimScraper['getForeignTransactions']>[0],
  pool: pg.Pool,
  isBusiness?: boolean,
) {
  const foreignTransactions = await newScraperIstance.getForeignTransactions(account, isBusiness);
  console.log(
    `finished getting foreignTransactions ${account.accountNumber}`,
    foreignTransactions.isValid,
  );
  if (!foreignTransactions.isValid) {
    console.log(
      `getForeignTransactions ${JSON.stringify(account.accountNumber)} schema error: `,
      'errors' in foreignTransactions ? foreignTransactions.errors : null,
    );
  }

  if (!foreignTransactions.data) {
    console.log(`No foreign data for ${account.accountNumber}`);
    return;
  }

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
      if (accountCurrency && foreignAccountsArray.transactions.length) {
        const bankNumber = (foreignAccountsArray as any).bankNumber ?? account.bankNumber;
        const branchNumber = (foreignAccountsArray as any).branchNumber ?? account.branchNumber;
        const accountNumber = (foreignAccountsArray as any).accountNumber ?? account.accountNumber;

        console.log(
          `Saving Foreign for ${bankNumber}:${branchNumber}:${accountNumber} currency ${accountCurrency}`,
        );
        await saveTransactionsToDB(
          foreignAccountsArray.transactions,
          accountCurrency,
          {
            accountNumber: accountNumber,
            branchNumber: branchNumber,
            bankNumber: bankNumber,
          },
          pool,
        );
        console.log(
          `Saved Foreign for ${bankNumber}:${branchNumber}:${accountNumber} currency ${accountCurrency}`,
        );
      }
    }),
  );
}

async function getBankData(pool: pg.Pool, scraper: Scraper) {
  console.log('start getBankData');
  console.log('Bank Login');

  if (!process.env.USER_CODE || !process.env.PASSWORD) {
    console.error('Missing credentials for bank');
    return;
  }

  const credentials = {
    userCode: process.env.USER_CODE,
    password: process.env.PASSWORD,
  };

  const isBusiness = process.env.IS_BUSINESS_ACCOUNT === 'false' ? false : true;

  const newPoalimInstance = await scraper.hapoalim(credentials, {
    validateSchema: true,
    isBusiness,
  });

  if (newPoalimInstance === 'Unknown Error') {
    console.error('Unknown Error fetching Poalim');
    return;
  }

  console.log('getting accounts');
  const accounts = await newPoalimInstance.getAccountsData();
  console.log('finished getting accounts', accounts.isValid);
  if (!accounts.isValid) {
    console.log(
      `getAccountsData Poalim schema errors: `,
      'errors' in accounts ? accounts.errors : null,
    );
  }

  if (!accounts.data) {
    console.log(`No Poalim accounts data`);
    return;
  }

  const tableName = 'financial_accounts';
  for (const account of accounts.data) {
    let whereClause = `
    SELECT * FROM ${`accounter_schema.` + tableName}
    WHERE 
    `;

    const columnNamesResult = await pool.query<{ column_name: string; data_type: string }>(`
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
      'hashavshevetAccountGbp',
      'metegDoarNet',
      'id',
      'type',
    ];
    if (account.accountUpdateDate == 0) {
      columnNamesToExcludeFromComparison.push('accountUpdateDate');
    }

    for (const dBcolumn of columnNamesResult.rows) {
      const camelCaseColumnName = camelCase(dBcolumn.column_name) as keyof typeof account;
      if (!columnNamesToExcludeFromComparison.includes(camelCaseColumnName)) {
        let actualCondition = '';
        const isNotNull =
          typeof account[camelCaseColumnName] !== 'undefined' &&
          account[camelCaseColumnName] != null;

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
          const firstKey = Object.keys(account[camelCaseColumnName])[0];
          actualCondition =
            `->> '` +
            firstKey +
            `' = '` +
            (account[camelCaseColumnName] as unknown as Record<string, unknown>)[firstKey] +
            `'`;
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
             `,
        );
      }
    }

    const lastIndexOfAND = whereClause.lastIndexOf('AND');
    whereClause = whereClause.substring(0, lastIndexOfAND);

    try {
      const res = await pool.query(whereClause);

      if (res.rowCount && res.rowCount > 0) {
        // console.log('found');
      } else {
        console.log(`Account not found!! ${JSON.stringify(account)}`);

        let columnNames = columnNamesResult.rows.map(column => column.column_name);

        columnNames = columnNames.filter((columnName: string) => columnName != 'id');
        let text = `INSERT INTO accounter_schema.${tableName}
        (
          ${columnNames.map(x => x).join(', ')},
        )`;
        const lastIndexOfComma = text.lastIndexOf(',');
        text = text
          .substring(0, lastIndexOfComma)
          .concat(text.substring(lastIndexOfComma + 1, text.length));

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
        ];

        const res = await pool.query(text, values);
        console.log(res);
      }
    } catch (error) {
      console.log('Accounts pg error - ', error);
    }
  }

  await Promise.all(
    accounts.data.map(async account => {
      console.log(`Getting ILS, Foreign and deposits for ${account.accountNumber}`);
      const results = await Promise.allSettled([
        getILSfromBankAndSave(newPoalimInstance, account, pool),
        getForeignTransactionsfromBankAndSave(newPoalimInstance, account, pool, isBusiness),
        getDepositsAndSave(newPoalimInstance, account, pool),
        // getForeignDepositsAndSave(newPoalimInstance, account, pool),
        getForeignSwiftTransactionsfromBankAndSave(newPoalimInstance, account, pool),
      ]);
      console.log(
        `got and saved ILS and Foreign for ${account.accountNumber} - ${JSON.stringify(results)}`,
      );
    }),
  );
  console.log('finish iterating over bank accounts');
  // await newScraper.close();
  // console.log('closed');
}

async function getDepositsAndSave(
  newScraperIstance: PoalimScraper,
  account: Parameters<PoalimScraper['getDeposits']>[0],
  pool: pg.Pool,
) {
  console.log('getting deposits');
  const deposits = await newScraperIstance.getDeposits(account);

  if (!deposits.data) {
    console.log(`No deposits data for ${account.accountNumber}`);
    return;
  }

  console.log(`finished getting deposits ${account.accountNumber}`, deposits.isValid);
  if (!deposits.isValid) {
    console.log(
      `getDeposits ${JSON.stringify(account.accountNumber)} schema errors: `,
      'errors' in deposits ? deposits.errors : null,
    );
  }

  if (
    account.accountNumber != 410915 &&
    account.accountNumber != 61066 &&
    account.accountNumber != 466803 &&
    account.accountNumber != 362396 &&
    account.accountNumber != 667871
  ) {
    console.error('UNKNOWN ACCOUNT ', account.accountNumber);
  } else {
    console.log(`Saving deposits for ${account.accountNumber}`);
    if (deposits.data.list.length != 1) {
      console.log('WRONG NUMBER OF DEPOSITS', deposits.data.list);
    } else {
      const messageslessDeposits: any = deposits.data.list[0];
      delete messageslessDeposits.messages;

      if (messageslessDeposits.data.length != 1) {
        console.log('Deposit internal array arong', deposits.data);
      } else {
        delete messageslessDeposits.data[0].metadata;

        const internalArrayKeys = Object.keys(messageslessDeposits.data[0]);

        for (const key of internalArrayKeys) {
          let pascalKey = camelCase(key);
          pascalKey = upperFirst(pascalKey);
          messageslessDeposits[`data0${pascalKey}`] = messageslessDeposits.data[0][key];
        }
        delete messageslessDeposits.data;

        await saveTransactionsToDB(
          [messageslessDeposits],
          'deposits',
          {
            accountNumber: account.accountNumber,
            branchNumber: account.branchNumber,
            bankNumber: account.bankNumber,
          },
          pool,
        );
      }
    }
    console.log(`Saved deposits for ${account.accountNumber}`);
  }
}

async function getForeignDepositsAndSave(
  newScraperIstance: PoalimScraper,
  account: Parameters<PoalimScraper['getForeignDeposits']>[0],
  pool: pg.Pool,
) {
  console.log('getting Foreign deposits');
  if (![466803, 362396, 667871].includes(account.accountNumber)) {
    return null;
  }
  const deposits = await newScraperIstance.getForeignDeposits(account);
  console.log(`finished Foreign getting deposits ${account.accountNumber}`, deposits.isValid);
  if (!deposits.isValid) {
    console.log(
      `getDeposits ${JSON.stringify(account.accountNumber)} schema errors: `,
      'errors' in deposits ? deposits.errors : null,
    );
  }

  if (
    account.accountNumber != 410915 &&
    account.accountNumber != 61066 &&
    account.accountNumber != 466803 &&
    account.accountNumber != 362396 &&
    account.accountNumber != 667871
  ) {
    console.error('UNKNOWN ACCOUNT ', account.accountNumber);
  } else if (!deposits.data) {
    console.log(`No deposits data for ${account.accountNumber}`);
    return;
  } else {
    console.log(`Saving Foreign deposits for ${account.accountNumber}`);

    if (
      deposits.data.listRevaluatedForeignCurrencyDepositAccountTypeCode[0]
        .listRevaluatedForeignCurrencyDepositProductSerialId[0]
        .listRevaluatedForeignCurrencyCodeDeposits[0].listRevaluatedForeignCurrencyDepositsRows
        .length != 1
    ) {
      console.log('Deposit internal array arong', deposits.data);
    } else {
      let foreignDepositsData =
        deposits.data.listRevaluatedForeignCurrencyDepositAccountTypeCode[0]
          .listRevaluatedForeignCurrencyDepositProductSerialId[0]
          .listRevaluatedForeignCurrencyCodeDeposits[0]
          .listRevaluatedForeignCurrencyDepositsRows[0];

      const internalArrayKeys = Object.keys(foreignDepositsData);

      for (const key of internalArrayKeys) {
        let pascalKey = camelCase(key);
        pascalKey = upperFirst(pascalKey);
        foreignDepositsData[`${pascalKey}`] = foreignDepositsData[key];
      }
      // delete deposits.data.list[0].data;

      await saveTransactionsToDB(
        [foreignDepositsData],
        'foreign_deposits',
        {
          accountNumber: account.accountNumber,
          branchNumber: account.branchNumber,
          bankNumber: account.bankNumber,
        },
        pool,
      );
    }

    console.log(`Saved deposits for ${account.accountNumber}`);
  }
}

async function getCreditCardTransactionsAndSave(
  month: Date,
  pool: pg.Pool,
  newIsracardInstance: IsracardScraper,
  id: string,
) {
  console.log(`Getting from isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`);
  const monthTransactions = await newIsracardInstance.getMonthTransactions(month);
  console.log(monthTransactions.isValid);
  if (!monthTransactions.isValid) {
    console.log(
      `newIsracardInstance.getMonthTransactions ${JSON.stringify(id)} schema error: `,
      'errors' in monthTransactions ? monthTransactions.errors : null,
    );
  }
  if (monthTransactions?.data?.Header?.Status != '1') {
    console.error(`Replace password for creditcard ${id}`);
    console.log(JSON.stringify(monthTransactions.data?.Header));
  }

  if (!monthTransactions.data) {
    console.log(`No data for isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`);
    return;
  }

  const allData = getTransactionsFromCards(monthTransactions.data.CardsTransactionsListBean);

  const wantedCreditCards = [
    '1082',
    '2733',
    '9217',
    '6264',
    '1074',
    '17 *',
    '5972',
    '6317',
    '6466',
    '9270',
    '5084',
  ];
  const onlyWantedCreditCardsTransactions = allData.filter(transaction =>
    wantedCreditCards.includes(transaction.card),
  );

  if (onlyWantedCreditCardsTransactions.length > 0) {
    console.log(`saving isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`);
    await saveTransactionsToDB(onlyWantedCreditCardsTransactions, 'isracard', null, pool);
    console.log(`finished saving isracard ${month.getMonth()}:${month.getFullYear()} - ${id}`);
  }
}

async function getCreditCardData(
  pool: pg.Pool,
  scraper: Scraper,
  credentials: Partial<isracardCredentials>,
) {
  console.log('start getCreditCardData');
  if (!credentials.ID || !credentials.password || !credentials.card6Digits) {
    console.error('Missing credentials for creditcard');
    return;
  }
  const id = credentials.ID;

  console.log('Creditcard Login');
  const newIsracardInstance = await scraper.isracard(
    {
      ID: id,
      password: credentials.password,
      card6Digits: credentials.card6Digits,
    },
    {
      validateSchema: true,
    },
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
      await getCreditCardTransactionsAndSave(currentMonthToFetch, pool, newIsracardInstance, id);
    }),
  );
  console.log(`after all creditcard months - ${credentials.ID}`);
}

async function getForeignSwiftTransactionsfromBankAndSave(
  newScraperIstance: PoalimScraper,
  account: Parameters<PoalimScraper['getForeignSwiftTransactions']>[0],
  pool: pg.Pool,
) {
  const foreignSwiftTransactions = await newScraperIstance.getForeignSwiftTransactions(account);
  // fs.writeFile(`./all_swift.json`, JSON.stringify(foreignSwiftTransactions), 'utf8', () => {
  //   console.log('done dumping query file');
  // });
  // fs.writeFile(
  //   `./all_swift_transaction.json`,
  //   JSON.stringify(foreignSwiftTransactions.data.swiftsList),
  //   'utf8',
  //   () => {
  //     console.log('done dumping query file');
  //   },
  // );
  // console.log(JSON.stringify(foreignSwiftTransactions));
  // console.log(
  //   `finished getting foreignTransactions ${account.accountNumber}`,
  //   foreignSwiftTransactions.isValid,
  // );
  if (!foreignSwiftTransactions.isValid) {
    console.log(
      `getForeignSwiftTransactions ${JSON.stringify(account.accountNumber)} schema error: `,
      'errors' in foreignSwiftTransactions ? foreignSwiftTransactions.errors : null,
    );
  } else if (!foreignSwiftTransactions.data) {
    console.log(`No foreign data for ${account.accountNumber}`);
    return;
  } else if (
    foreignSwiftTransactions.data.swiftsList &&
    foreignSwiftTransactions.data.swiftsList.length > 0
  ) {
    await Promise.all(
      foreignSwiftTransactions.data.swiftsList.map(async foreignSwiftTransaction => {
        // console.log(JSON.stringify(foreignSwiftTransaction));
        // console.log(foreignSwiftTransaction.transferCatenatedId);
        if (
          foreignSwiftTransaction.dataOriginCode == 2 &&
          foreignSwiftTransaction.currencyLongDescription != 'שקל חדש'
        ) {
          let tableName = `poalim_swift_account_transactions`;
          const queryForExisting = `select transfer_catenated_id from accounter_schema.${tableName} where transfer_catenated_id = $$${foreignSwiftTransaction.transferCatenatedId}$$;`;
          const findIfAlreadyExistsStatement = await pool.query(queryForExisting);
          if (findIfAlreadyExistsStatement.rowCount == 0) {
            try {
              const foreignSwiftTransactionDetails =
                await newScraperIstance.getForeignSwiftTransaction(
                  account,
                  foreignSwiftTransaction.transferCatenatedId,
                );
              // console.log(foreignSwiftTransaction);
              // console.log(foreignSwiftTransactionDetails);

              // fs.writeFile(
              //   `./swift_transaction_${foreignSwiftTransaction.transferCatenatedId}.json`,
              //   JSON.stringify(foreignSwiftTransactionDetails),
              //   'utf8',
              //   () => {
              //     console.log('done dumping query file');
              //   },
              // );
              if (!foreignSwiftTransactionDetails.isValid) {
                console.log(
                  `getForeignSwiftTransaction ${JSON.stringify(
                    foreignSwiftTransaction,
                  )} schema error: `,
                  'errors' in foreignSwiftTransactionDetails
                    ? foreignSwiftTransactionDetails.errors
                    : null,
                );
                // console.log(JSON.stringify(foreignSwiftTransactionDetails));
              } else if (!foreignSwiftTransactionDetails.data) {
                console.log(`No foreign data for ${foreignSwiftTransaction.transferCatenatedId}`);
              } else {
                console.log(`building ${foreignSwiftTransaction.transferCatenatedId}`);
                console.log(
                  JSON.stringify(foreignSwiftTransactionDetails.data.swiftTransferDetailsList),
                );

                let valueSwift33B = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':33B:',
                  )
                ) {
                  valueSwift33B = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':33B:',
                  )!.swiftTransferAttributeValue;
                }

                let valueSwift53 = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':53B:',
                  )
                ) {
                  valueSwift53 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':53B:',
                  )!.swiftTransferAttributeValue;
                } else if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':53A:',
                  )
                ) {
                  valueSwift53 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':53A:',
                  )!.swiftTransferAttributeValue;
                }

                let valueSwift54A = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':54A:',
                  )
                ) {
                  valueSwift54A = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':54A:',
                  )!.swiftTransferAttributeValue;
                }

                let valueSwift71A = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':71A:',
                  )
                ) {
                  valueSwift71A = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':71A:',
                  )!.swiftTransferAttributeValue;
                }

                let valueSwift501 = ' ';
                let valueSwift502 = ' ';
                let valueSwift503 = ' ';
                let valueSwift504 = ' ';
                let valueSwift505 = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':50K:',
                  )
                ) {
                  valueSwift501 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':50K:',
                  )!.swiftTransferAttributeValue;

                  valueSwift502 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':50K:',
                      ) + 1
                    ].swiftTransferAttributeValue;

                  valueSwift503 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':50K:',
                      ) + 2
                    ].swiftTransferAttributeValue;

                  valueSwift504 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':50K:',
                      ) + 3
                    ].swiftTransferAttributeValue;

                  valueSwift505 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':50K:',
                      ) + 4
                    ].swiftTransferAttributeValue;
                } else if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':50F:',
                  )
                ) {
                  valueSwift501 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':50F:',
                  )!.swiftTransferAttributeValue;

                  valueSwift502 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':50F:',
                      ) + 1
                    ].swiftTransferAttributeValue;

                  valueSwift503 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':50F:',
                      ) + 2
                    ].swiftTransferAttributeValue;

                  valueSwift504 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':50F:',
                      ) + 3
                    ].swiftTransferAttributeValue;

                  valueSwift505 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':50F:',
                      ) + 4
                    ].swiftTransferAttributeValue;
                }

                let valueSwift591 = ' ';
                let valueSwift592 = ' ';
                let valueSwift593 = ' ';
                let valueSwift594 = ' ';
                let valueSwift595 = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':59:',
                  )
                ) {
                  valueSwift591 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':59:',
                  )!.swiftTransferAttributeValue;

                  valueSwift592 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':59:',
                      ) + 1
                    ].swiftTransferAttributeValue;

                  if (
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':59:',
                      ) + 2
                    ]
                  ) {
                    valueSwift593 =
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                        foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                          element => element.swiftTransferAttributeCode == ':59:',
                        ) + 2
                      ].swiftTransferAttributeValue;
                  }

                  if (
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':59:',
                      ) + 3
                    ]
                  ) {
                    valueSwift594 =
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                        foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                          element => element.swiftTransferAttributeCode == ':59:',
                        ) + 3
                      ].swiftTransferAttributeValue;
                  }

                  if (
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':59:',
                      ) + 4
                    ]
                  ) {
                    valueSwift595 =
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                        foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                          element => element.swiftTransferAttributeCode == ':59:',
                        ) + 4
                      ].swiftTransferAttributeValue;
                  }
                } else if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':59F:',
                  )
                ) {
                  valueSwift591 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':59F:',
                  )!.swiftTransferAttributeValue;

                  valueSwift592 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':59F:',
                      ) + 1
                    ].swiftTransferAttributeValue;

                  valueSwift593 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':59F:',
                      ) + 2
                    ].swiftTransferAttributeValue;

                  valueSwift594 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':59F:',
                      ) + 3
                    ].swiftTransferAttributeValue;

                  valueSwift595 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':59F:',
                      ) + 4
                    ].swiftTransferAttributeValue;
                }

                let valueSwift52A = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':52A:',
                  )
                ) {
                  valueSwift52A = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':52A:',
                  )!.swiftTransferAttributeValue;
                }

                let valueSwift52D1 = ' ';
                let valueSwift52D2 = ' ';
                let valueSwift52D3 = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':52D:',
                  )
                ) {
                  valueSwift52D1 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                      element => element.swiftTransferAttributeCode == ':52D:',
                    )!.swiftTransferAttributeValue;

                  valueSwift52D2 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':52D:',
                      ) + 1
                    ].swiftTransferAttributeValue;

                  valueSwift52D3 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':52D:',
                      ) + 2
                    ].swiftTransferAttributeValue;
                }

                let valueSwift701 = ' ';
                let valueSwift702 = ' ';

                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':70:',
                  )
                ) {
                  valueSwift701 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':70:',
                  )!.swiftTransferAttributeValue;

                  valueSwift702 =
                    foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
                        element => element.swiftTransferAttributeCode == ':70:',
                      ) + 1
                    ].swiftTransferAttributeValue;
                }

                let valueSwift71F = ' ';
                if (
                  foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':71F:',
                  )
                ) {
                  valueSwift71F = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                    element => element.swiftTransferAttributeCode == ':71F:',
                  )!.swiftTransferAttributeValue;
                }

                let query = `INSERT INTO accounter_schema.${tableName} (
                    account_number,
                    branch_number,
                    bank_number,
    
                    start_date,
                    formatted_start_date,
                    swift_status_code,
                    swift_status_desc,
                    amount,
                    currency_code_catenated_key,
                    currency_long_description,
                    charge_party_name,
                    reference_number,
                    transfer_catenated_id,
                    data_origin_code,
      
                    swift_isn_serial_number,
                    swift_bank_code,
                    order_customer_name,
                    beneficiary_english_street_name,
                    beneficiary_english_city_name,
                    beneficiary_english_country_name,
      
      
                    swift_senders_reference_20,
                    swift_bank_operation_code_23B,
                    swift_value_date_currency_amount_32A,
                    swift_currency_instructed_amount_33B,
              
                    swift_ordering_customer_50K_1,
                    swift_ordering_customer_50K_2,
                    swift_ordering_customer_50K_3,
                    swift_ordering_customer_50K_4,
                    swift_ordering_customer_50K_5,
      
                    swift_ordering_institution_52A,
  
                    swift_ordering_institution_52D_1,
                    swift_ordering_institution_52D_2,
                    swift_ordering_institution_52D_3,
  
                    swift_senders_correspondent_53A,
  
                    swift_receivers_correspondent_54A,
                    swift_beneficiary_customer_59_1,
                    swift_beneficiary_customer_59_2,
                    swift_beneficiary_customer_59_3,
                    swift_beneficiary_customer_59_4,
                    swift_beneficiary_customer_59_5,
                    swift_remittance_information_70_1,
                    swift_remittance_information_70_2,
                    swift_details_of_charges_71A,
                    swift_senders_charges_71F
                  ) VALUES (
                    $$${account.accountNumber}$$,
                    $$${account.branchNumber}$$,
                    $$${account.bankNumber}$$,
    
                    $$${foreignSwiftTransaction.startDate}$$,
                    $$${foreignSwiftTransaction.formattedStartDate}$$,
                    $$${foreignSwiftTransaction.swiftStatusCode}$$,
                    $$${foreignSwiftTransaction.swiftStatusDesc}$$,
                    $$${foreignSwiftTransaction.amount}$$,
                    $$${foreignSwiftTransaction.currencyCodeCatenatedKey}$$,
                    $$${foreignSwiftTransaction.currencyLongDescription}$$,
                    $$${foreignSwiftTransaction.chargePartyName}$$,
                    $$${foreignSwiftTransaction.referenceNumber}$$,
                    $$${foreignSwiftTransaction.transferCatenatedId}$$,
                    $$${foreignSwiftTransaction.dataOriginCode}$$,
    
                    $$${
                      foreignSwiftTransactionDetails.data.swiftBankDetails.swiftIsnSerialNumber
                    }$$,
                    $$${foreignSwiftTransactionDetails.data.swiftBankDetails.swiftBankCode}$$,
                    $$${foreignSwiftTransactionDetails.data.swiftBankDetails.orderCustomerName}$$,
                    $$${
                      foreignSwiftTransactionDetails.data.swiftBankDetails
                        .beneficiaryEnglishStreetName1
                    }$$,
                    $$${
                      foreignSwiftTransactionDetails.data.swiftBankDetails
                        .beneficiaryEnglishCityName1
                    }$$,
                    $$${
                      foreignSwiftTransactionDetails.data.swiftBankDetails
                        .beneficiaryEnglishCountryName
                    }$$,
    
                    $$${
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                        element => element.swiftTransferAttributeCode == ':20:',
                      )?.swiftTransferAttributeValue
                    }$$,
                    $$${
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                        element => element.swiftTransferAttributeCode == ':23B:',
                      )?.swiftTransferAttributeValue
                    }$$,
                    $$${
                      foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
                        element => element.swiftTransferAttributeCode == ':32A:',
                      )?.swiftTransferAttributeValue
                    }$$,
                    $$${valueSwift33B}$$,
    
                    $$${valueSwift501}$$,
                    $$${valueSwift502}$$,
                    $$${valueSwift503}$$,
                    $$${valueSwift504}$$,
                    $$${valueSwift505}$$,
    
                    $$${valueSwift52A}$$,
    
                    $$${valueSwift52D1}$$,
                    $$${valueSwift52D2}$$,
                    $$${valueSwift52D3}$$,
  
                    $$${valueSwift53}$$,
  
                    $$${valueSwift54A}$$,
    
                    $$${valueSwift591}$$,
                    $$${valueSwift592}$$,
                    $$${valueSwift593}$$,
                    $$${valueSwift594}$$,
                    $$${valueSwift595}$$,
    
                    $$${valueSwift701}$$,
                    $$${valueSwift702}$$,
    
                    $$${valueSwift71A}$$,
  
                      
                    $$${valueSwift71F}$$
                    
                    );`;

                query = query.replace(/(\r\n|\n|\r)/gm, '');
                // console.log('query', query);
                // fs.writeFile(
                //   `./query_${foreignSwiftTransaction.transferCatenatedId}.txt`,
                //   query,
                //   'utf8',
                //   () => {
                //     console.log('done dumping query file');
                //   },
                // );
                console.log(`executing ${foreignSwiftTransaction.transferCatenatedId}`);
                const insertResult: any = await pool.query(query);
                console.log(`done ${foreignSwiftTransaction.transferCatenatedId}`);

                // console.log(JSON.stringify(insertResult));
              }
            } catch (e) {
              console.log(e);
              console.log(JSON.stringify(foreignSwiftTransaction));
            }
          } else {
            console.log('skipping ', foreignSwiftTransaction.transferCatenatedId);
          }
        } else {
          if (foreignSwiftTransaction.currencyLongDescription == 'שקל חדש') {
            console.log(`
              ${foreignSwiftTransaction.startDate}
              ${foreignSwiftTransaction.amount}
              ${foreignSwiftTransaction.chargePartyName} 
              is SHEKEL`);
          } else {
            console.log(`
            ${foreignSwiftTransaction.startDate}
            ${foreignSwiftTransaction.amount}
            ${foreignSwiftTransaction.chargePartyName}
            is not ready yet`);
          }
        }
      }),
    );
  }
}

(async () => {
  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL ? { rejectUnauthorized: false } : false,
  });

  console.log('Init scraper');
  const newScraperInstance = await init();
  const secondScraperInstance = await init();
  const thirdScraperInstance = await init();
  console.log('After Init scraper');
  await Promise.allSettled([
    getCreditCardData(pool, newScraperInstance, {
      ID: process.env.ISRACARD_ID,
      password: process.env.ISRACARD_PASSWORD,
      card6Digits: process.env.ISRACARD_6_DIGITS,
    }),
    getCreditCardData(pool, thirdScraperInstance, {
      ID: process.env.DOTAN_ISRACARD_ID,
      password: process.env.DOTAN_ISRACARD_PASSWORD,
      card6Digits: process.env.DOTAN_ISRACARD_6_DIGITS,
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

type Scraper = Awaited<ReturnType<typeof init>>;
type IsracardScraper = Awaited<ReturnType<Scraper['isracard']>>;
type PoalimScraper = Exclude<Awaited<ReturnType<Scraper['hapoalim']>>, 'Unknown Error'>;
