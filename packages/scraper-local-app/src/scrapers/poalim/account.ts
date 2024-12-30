import Listr from 'listr';
import type { Pool } from 'pg';
import type { ScrapedAccount } from './accounts.js';
import { getForeignTransactions } from './foreign-transactions.js';
import { getIlsTransactions } from './ils-transactions.js';
import type { PoalimContext } from './index.js';

// async function getDepositsAndSave(
//   newScraperIstance: PoalimScraper,
//   account: Parameters<PoalimScraper['getDeposits']>[0],
//   pool: Pool,
// ) {
//   console.log('getting deposits');
//   const deposits = await newScraperIstance.getDeposits(account);

//   if (!deposits.data) {
//     console.log(`No deposits data for ${account.accountNumber}`);
//     return;
//   }

//   console.log(`finished getting deposits ${account.accountNumber}`, deposits.isValid);
//   if (!deposits.isValid) {
//     console.log(
//       `getDeposits ${JSON.stringify(account.accountNumber)} schema errors: `,
//       'errors' in deposits ? deposits.errors : null,
//     );
//   }

//   if (
//     account.accountNumber !== 410_915 &&
//     account.accountNumber !== 61_066 &&
//     account.accountNumber !== 466_803 &&
//     account.accountNumber !== 362_396 &&
//     account.accountNumber !== 667_871
//   ) {
//     console.error('UNKNOWN ACCOUNT ', account.accountNumber);
//   } else {
//     console.log(`Saving deposits for ${account.accountNumber}`);
//     if (deposits.data.list.length !== 1) {
//       console.log('WRONG NUMBER OF DEPOSITS', deposits.data.list);
//     } else {
//       const messageslessDeposits: any = deposits.data.list[0];
//       delete messageslessDeposits.messages;

//       if (messageslessDeposits.data.length !== 1) {
//         console.log('Deposit internal array arong', deposits.data);
//       } else {
//         delete messageslessDeposits.data[0].metadata;

//         const internalArrayKeys = Object.keys(messageslessDeposits.data[0]);

//         for (const key of internalArrayKeys) {
//           let pascalKey = camelCase(key);
//           pascalKey = upperFirst(pascalKey);
//           messageslessDeposits[`data0${pascalKey}`] = messageslessDeposits.data[0][key];
//         }
//         delete messageslessDeposits.data;

//         await saveTransactionsToDB(
//           [messageslessDeposits],
//           'deposits',
//           {
//             accountNumber: account.accountNumber,
//             branchNumber: account.branchNumber,
//             bankNumber: account.bankNumber,
//           },
//           pool,
//         );
//       }
//     }
//     console.log(`Saved deposits for ${account.accountNumber}`);
//   }
// }

// async function getForeignSwiftTransactionsfromBankAndSave(
//   newScraperIstance: PoalimScraper,
//   account: Parameters<PoalimScraper['getForeignSwiftTransactions']>[0],
//   pool: Pool,
// ) {
//   const foreignSwiftTransactions = await newScraperIstance.getForeignSwiftTransactions(account);
//   // fs.writeFile(`./all_swift.json`, JSON.stringify(foreignSwiftTransactions), 'utf8', () => {
//   //   console.log('done dumping query file');
//   // });
//   // fs.writeFile(
//   //   `./all_swift_transaction.json`,
//   //   JSON.stringify(foreignSwiftTransactions.data.swiftsList),
//   //   'utf8',
//   //   () => {
//   //     console.log('done dumping query file');
//   //   },
//   // );
//   // console.log(JSON.stringify(foreignSwiftTransactions));
//   // console.log(
//   //   `finished getting foreignTransactions ${account.accountNumber}`,
//   //   foreignSwiftTransactions.isValid,
//   // );
//   if (!foreignSwiftTransactions.isValid) {
//     console.log(
//       `getForeignSwiftTransactions ${JSON.stringify(account.accountNumber)} schema error: `,
//       'errors' in foreignSwiftTransactions ? foreignSwiftTransactions.errors : null,
//     );
//   } else if (!foreignSwiftTransactions.data) {
//     console.log(`No foreign data for ${account.accountNumber}`);
//     return;
//   } else if (
//     foreignSwiftTransactions.data.swiftsList &&
//     foreignSwiftTransactions.data.swiftsList.length > 0
//   ) {
//     await Promise.all(
//       foreignSwiftTransactions.data.swiftsList.map(async foreignSwiftTransaction => {
//         // console.log(JSON.stringify(foreignSwiftTransaction));
//         // console.log(foreignSwiftTransaction.transferCatenatedId);
//         if (
//           foreignSwiftTransaction.dataOriginCode === 2 &&
//           foreignSwiftTransaction.currencyLongDescription !== 'שקל חדש'
//         ) {
//           let tableName = `poalim_swift_account_transactions`;
//           const queryForExisting = `select transfer_catenated_id from accounter_schema.${tableName} where transfer_catenated_id = $$${foreignSwiftTransaction.transferCatenatedId}$$;`;
//           const findIfAlreadyExistsStatement = await pool.query(queryForExisting);
//           if (findIfAlreadyExistsStatement.rowCount == 0) {
//             try {
//               const foreignSwiftTransactionDetails =
//                 await newScraperIstance.getForeignSwiftTransaction(
//                   account,
//                   foreignSwiftTransaction.transferCatenatedId,
//                 );
//               // console.log(foreignSwiftTransaction);
//               // console.log(foreignSwiftTransactionDetails);

//               // fs.writeFile(
//               //   `./swift_transaction_${foreignSwiftTransaction.transferCatenatedId}.json`,
//               //   JSON.stringify(foreignSwiftTransactionDetails),
//               //   'utf8',
//               //   () => {
//               //     console.log('done dumping query file');
//               //   },
//               // );
//               if (!foreignSwiftTransactionDetails.isValid) {
//                 console.log(
//                   `getForeignSwiftTransaction ${JSON.stringify(
//                     foreignSwiftTransaction,
//                   )} schema error: `,
//                   'errors' in foreignSwiftTransactionDetails
//                     ? foreignSwiftTransactionDetails.errors
//                     : null,
//                 );
//                 // console.log(JSON.stringify(foreignSwiftTransactionDetails));
//               } else if (!foreignSwiftTransactionDetails.data) {
//                 console.log(`No foreign data for ${foreignSwiftTransaction.transferCatenatedId}`);
//               } else {
//                 console.log(`building ${foreignSwiftTransaction.transferCatenatedId}`);
//                 console.log(
//                   JSON.stringify(foreignSwiftTransactionDetails.data.swiftTransferDetailsList),
//                 );

//                 let valueSwift33B = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':33B:',
//                   )
//                 ) {
//                   valueSwift33B = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':33B:',
//                   )!.swiftTransferAttributeValue;
//                 }

//                 let valueSwift53 = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':53B:',
//                   )
//                 ) {
//                   valueSwift53 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':53B:',
//                   )!.swiftTransferAttributeValue;
//                 } else if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':53A:',
//                   )
//                 ) {
//                   valueSwift53 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':53A:',
//                   )!.swiftTransferAttributeValue;
//                 }

//                 let valueSwift54A = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':54A:',
//                   )
//                 ) {
//                   valueSwift54A = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':54A:',
//                   )!.swiftTransferAttributeValue;
//                 }

//                 let valueSwift71A = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':71A:',
//                   )
//                 ) {
//                   valueSwift71A = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':71A:',
//                   )!.swiftTransferAttributeValue;
//                 }

//                 let valueSwift501 = ' ';
//                 let valueSwift502 = ' ';
//                 let valueSwift503 = ' ';
//                 let valueSwift504 = ' ';
//                 let valueSwift505 = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':50K:',
//                   )
//                 ) {
//                   valueSwift501 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':50K:',
//                   )!.swiftTransferAttributeValue;

//                   valueSwift502 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':50K:',
//                       ) + 1
//                     ].swiftTransferAttributeValue;

//                   valueSwift503 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':50K:',
//                       ) + 2
//                     ].swiftTransferAttributeValue;

//                   valueSwift504 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':50K:',
//                       ) + 3
//                     ].swiftTransferAttributeValue;

//                   valueSwift505 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':50K:',
//                       ) + 4
//                     ].swiftTransferAttributeValue;
//                 } else if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':50F:',
//                   )
//                 ) {
//                   valueSwift501 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':50F:',
//                   )!.swiftTransferAttributeValue;

//                   valueSwift502 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':50F:',
//                       ) + 1
//                     ].swiftTransferAttributeValue;

//                   valueSwift503 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':50F:',
//                       ) + 2
//                     ].swiftTransferAttributeValue;

//                   valueSwift504 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':50F:',
//                       ) + 3
//                     ].swiftTransferAttributeValue;

//                   valueSwift505 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':50F:',
//                       ) + 4
//                     ].swiftTransferAttributeValue;
//                 }

//                 let valueSwift591 = ' ';
//                 let valueSwift592 = ' ';
//                 let valueSwift593 = ' ';
//                 let valueSwift594 = ' ';
//                 let valueSwift595 = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':59:',
//                   )
//                 ) {
//                   valueSwift591 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':59:',
//                   )!.swiftTransferAttributeValue;

//                   valueSwift592 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':59:',
//                       ) + 1
//                     ].swiftTransferAttributeValue;

//                   if (
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':59:',
//                       ) + 2
//                     ]
//                   ) {
//                     valueSwift593 =
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                         foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                           element => element.swiftTransferAttributeCode === ':59:',
//                         ) + 2
//                       ].swiftTransferAttributeValue;
//                   }

//                   if (
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':59:',
//                       ) + 3
//                     ]
//                   ) {
//                     valueSwift594 =
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                         foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                           element => element.swiftTransferAttributeCode === ':59:',
//                         ) + 3
//                       ].swiftTransferAttributeValue;
//                   }

//                   if (
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':59:',
//                       ) + 4
//                     ]
//                   ) {
//                     valueSwift595 =
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                         foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                           element => element.swiftTransferAttributeCode === ':59:',
//                         ) + 4
//                       ].swiftTransferAttributeValue;
//                   }
//                 } else if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':59F:',
//                   )
//                 ) {
//                   valueSwift591 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':59F:',
//                   )!.swiftTransferAttributeValue;

//                   valueSwift592 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':59F:',
//                       ) + 1
//                     ].swiftTransferAttributeValue;

//                   valueSwift593 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':59F:',
//                       ) + 2
//                     ].swiftTransferAttributeValue;

//                   valueSwift594 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':59F:',
//                       ) + 3
//                     ].swiftTransferAttributeValue;

//                   valueSwift595 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':59F:',
//                       ) + 4
//                     ].swiftTransferAttributeValue;
//                 }

//                 let valueSwift52A = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':52A:',
//                   )
//                 ) {
//                   valueSwift52A = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':52A:',
//                   )!.swiftTransferAttributeValue;
//                 }

//                 let valueSwift52D1 = ' ';
//                 let valueSwift52D2 = ' ';
//                 let valueSwift52D3 = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':52D:',
//                   )
//                 ) {
//                   valueSwift52D1 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                       element => element.swiftTransferAttributeCode === ':52D:',
//                     )!.swiftTransferAttributeValue;

//                   valueSwift52D2 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':52D:',
//                       ) + 1
//                     ].swiftTransferAttributeValue;

//                   valueSwift52D3 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':52D:',
//                       ) + 2
//                     ].swiftTransferAttributeValue;
//                 }

//                 let valueSwift701 = ' ';
//                 let valueSwift702 = ' ';

//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':70:',
//                   )
//                 ) {
//                   valueSwift701 = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':70:',
//                   )!.swiftTransferAttributeValue;

//                   valueSwift702 =
//                     foreignSwiftTransactionDetails.data.swiftTransferDetailsList[
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.findIndex(
//                         element => element.swiftTransferAttributeCode === ':70:',
//                       ) + 1
//                     ].swiftTransferAttributeValue;
//                 }

//                 let valueSwift71F = ' ';
//                 if (
//                   foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':71F:',
//                   )
//                 ) {
//                   valueSwift71F = foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                     element => element.swiftTransferAttributeCode === ':71F:',
//                   )!.swiftTransferAttributeValue;
//                 }

//                 let query = `INSERT INTO accounter_schema.${tableName} (
//                     account_number,
//                     branch_number,
//                     bank_number,

//                     start_date,
//                     formatted_start_date,
//                     swift_status_code,
//                     swift_status_desc,
//                     amount,
//                     currency_code_catenated_key,
//                     currency_long_description,
//                     charge_party_name,
//                     reference_number,
//                     transfer_catenated_id,
//                     data_origin_code,

//                     swift_isn_serial_number,
//                     swift_bank_code,
//                     order_customer_name,
//                     beneficiary_english_street_name,
//                     beneficiary_english_city_name,
//                     beneficiary_english_country_name,

//                     swift_senders_reference_20,
//                     swift_bank_operation_code_23B,
//                     swift_value_date_currency_amount_32A,
//                     swift_currency_instructed_amount_33B,

//                     swift_ordering_customer_50K_1,
//                     swift_ordering_customer_50K_2,
//                     swift_ordering_customer_50K_3,
//                     swift_ordering_customer_50K_4,
//                     swift_ordering_customer_50K_5,

//                     swift_ordering_institution_52A,

//                     swift_ordering_institution_52D_1,
//                     swift_ordering_institution_52D_2,
//                     swift_ordering_institution_52D_3,

//                     swift_senders_correspondent_53A,

//                     swift_receivers_correspondent_54A,
//                     swift_beneficiary_customer_59_1,
//                     swift_beneficiary_customer_59_2,
//                     swift_beneficiary_customer_59_3,
//                     swift_beneficiary_customer_59_4,
//                     swift_beneficiary_customer_59_5,
//                     swift_remittance_information_70_1,
//                     swift_remittance_information_70_2,
//                     swift_details_of_charges_71A,
//                     swift_senders_charges_71F
//                   ) VALUES (
//                     $$${account.accountNumber}$$,
//                     $$${account.branchNumber}$$,
//                     $$${account.bankNumber}$$,

//                     $$${foreignSwiftTransaction.startDate}$$,
//                     $$${foreignSwiftTransaction.formattedStartDate}$$,
//                     $$${foreignSwiftTransaction.swiftStatusCode}$$,
//                     $$${foreignSwiftTransaction.swiftStatusDesc}$$,
//                     $$${foreignSwiftTransaction.amount}$$,
//                     $$${foreignSwiftTransaction.currencyCodeCatenatedKey}$$,
//                     $$${foreignSwiftTransaction.currencyLongDescription}$$,
//                     $$${foreignSwiftTransaction.chargePartyName}$$,
//                     $$${foreignSwiftTransaction.referenceNumber}$$,
//                     $$${foreignSwiftTransaction.transferCatenatedId}$$,
//                     $$${foreignSwiftTransaction.dataOriginCode}$$,

//                     $$${
//                       foreignSwiftTransactionDetails.data.swiftBankDetails.swiftIsnSerialNumber
//                     }$$,
//                     $$${foreignSwiftTransactionDetails.data.swiftBankDetails.swiftBankCode}$$,
//                     $$${foreignSwiftTransactionDetails.data.swiftBankDetails.orderCustomerName}$$,
//                     $$${
//                       foreignSwiftTransactionDetails.data.swiftBankDetails
//                         .beneficiaryEnglishStreetName1
//                     }$$,
//                     $$${
//                       foreignSwiftTransactionDetails.data.swiftBankDetails
//                         .beneficiaryEnglishCityName1
//                     }$$,
//                     $$${
//                       foreignSwiftTransactionDetails.data.swiftBankDetails
//                         .beneficiaryEnglishCountryName
//                     }$$,

//                     $$${
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                         element => element.swiftTransferAttributeCode === ':20:',
//                       )?.swiftTransferAttributeValue
//                     }$$,
//                     $$${
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                         element => element.swiftTransferAttributeCode === ':23B:',
//                       )?.swiftTransferAttributeValue
//                     }$$,
//                     $$${
//                       foreignSwiftTransactionDetails.data.swiftTransferDetailsList.find(
//                         element => element.swiftTransferAttributeCode === ':32A:',
//                       )?.swiftTransferAttributeValue
//                     }$$,
//                     $$${valueSwift33B}$$,

//                     $$${valueSwift501}$$,
//                     $$${valueSwift502}$$,
//                     $$${valueSwift503}$$,
//                     $$${valueSwift504}$$,
//                     $$${valueSwift505}$$,

//                     $$${valueSwift52A}$$,

//                     $$${valueSwift52D1}$$,
//                     $$${valueSwift52D2}$$,
//                     $$${valueSwift52D3}$$,

//                     $$${valueSwift53}$$,

//                     $$${valueSwift54A}$$,

//                     $$${valueSwift591}$$,
//                     $$${valueSwift592}$$,
//                     $$${valueSwift593}$$,
//                     $$${valueSwift594}$$,
//                     $$${valueSwift595}$$,

//                     $$${valueSwift701}$$,
//                     $$${valueSwift702}$$,

//                     $$${valueSwift71A}$$,

//                     $$${valueSwift71F}$$

//                     );`;

//                 query = query.replace(/(\r\n|\n|\r)/gm, '');
//                 // console.log('query', query);
//                 // fs.writeFile(
//                 //   `./query_${foreignSwiftTransaction.transferCatenatedId}.txt`,
//                 //   query,
//                 //   'utf8',
//                 //   () => {
//                 //     console.log('done dumping query file');
//                 //   },
//                 // );
//                 console.log(`executing ${foreignSwiftTransaction.transferCatenatedId}`);
//                 const insertResult: any = await pool.query(query);
//                 console.log(`done ${foreignSwiftTransaction.transferCatenatedId}`);

//                 // console.log(JSON.stringify(insertResult));
//               }
//             } catch (e) {
//               console.log(e);
//               console.log(JSON.stringify(foreignSwiftTransaction));
//             }
//           } else {
//             console.log('skipping ', foreignSwiftTransaction.transferCatenatedId);
//           }
//         } else if (foreignSwiftTransaction.currencyLongDescription === 'שקל חדש') {
//           console.log(`
//               ${foreignSwiftTransaction.startDate}
//               ${foreignSwiftTransaction.amount}
//               ${foreignSwiftTransaction.chargePartyName}
//               is SHEKEL`);
//         } else {
//           console.log(`
//             ${foreignSwiftTransaction.startDate}
//             ${foreignSwiftTransaction.amount}
//             ${foreignSwiftTransaction.chargePartyName}
//             is not ready yet`);
//         }
//       }),
//     );
//   }
// }

export async function handlePoalimAccount(
  account: ScrapedAccount,
  pool: Pool,
  parentCtx: PoalimContext,
) {
  return new Listr<unknown>(
    [
      {
        title: 'Get ILS transactions',
        enabled: () =>
          !!parentCtx.scraper && !!parentCtx.columns?.['poalim_ils_account_transactions'],
        task: async () => getIlsTransactions(pool, account, parentCtx),
      },
      {
        title: 'Get foreign transactions',
        enabled: () => !!parentCtx.scraper,
        task: async () => getForeignTransactions(pool, account, parentCtx),
      },
    ],
    { concurrent: true },
  );
}

// await Promise.all(
//   accounts.data.map(async account => {
//     console.log(`Getting ILS, Foreign and deposits for ${account.accountNumber}`);
//     const results = await Promise.allSettled([
//       getDepositsAndSave(newPoalimInstance, account, pool),
//       // getForeignDepositsAndSave(newPoalimInstance, account, pool),
//       getForeignSwiftTransactionsfromBankAndSave(newPoalimInstance, account, pool),
//     ]);
//     console.log(
//       `got and saved ILS and Foreign for ${account.accountNumber} - ${JSON.stringify(results)}`,
//     );
//   }),
// );
// console.log('finish iterating over bank accounts');
// // await newScraper.close();
// // console.log('closed');
