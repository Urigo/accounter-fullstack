import Listr, { type ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import type { ForeignSwiftTransaction } from '@accounter/modern-poalim-scraper/dist/__generated__/foreignSwiftTransaction.js';
import type { ForeignSwiftTransactions } from '@accounter/modern-poalim-scraper/dist/__generated__/foreignSwiftTransactions.js';
import { sql } from '@pgtyped/runtime';
import type {
  ICheckForExistingSwiftTransactionQuery,
  IInsertSwiftTransactionParams,
  IInsertSwiftTransactionQuery,
} from '../../helpers/types.js';
import type { Logger } from '../../logger.js';
import type { ScrapedAccount } from './accounts.js';
import type { PoalimScraper, PoalimUserContext } from './index.js';

type SwiftContext = {
  transactions?: SwiftTransaction[];
  newTransactions?: SwiftTransaction[];
  insertableTransactions?: SwiftTransaction[];
};
type SwiftTransaction = ForeignSwiftTransactions['swiftsList'][number];

const checkForExistingSwiftTransaction = sql<ICheckForExistingSwiftTransactionQuery>`
  SELECT transfer_catenated_id
  FROM accounter_schema.poalim_swift_account_transactions
  WHERE transfer_catenated_id = $transferCatenatedId;`;

const insertSwiftTransaction = sql<IInsertSwiftTransactionQuery>`
  INSERT INTO accounter_schema.poalim_swift_account_transactions (account_number,
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
) VALUES $$switfTransactions(accountNumber,
                              branchNumber,
                              bankNumber,

                              startDate,
                              formattedStartDate,
                              swiftStatusCode,
                              swiftStatusDesc,
                              amount,
                              currencyCodeCatenatedKey,
                              currencyLongDescription,
                              chargePartyName,
                              referenceNumber,
                              transferCatenatedId,
                              dataOriginCode,

                              swiftIsnSerialNumber,
                              swiftBankCode,
                              orderCustomerName,
                              beneficiaryEnglishStreetName,
                              beneficiaryEnglishCityName,
                              beneficiaryEnglishCountryName,

                              swiftSendersReference20,
                              swiftBankOperationCode23B,
                              swiftValueDateCurrencyAmount32A,
                              swiftCurrencyInstructedAmount33B,

                              swiftOrderingCustomer50K1,
                              swiftOrderingCustomer50K2,
                              swiftOrderingCustomer50K3,
                              swiftOrderingCustomer50K4,
                              swiftOrderingCustomer50K5,

                              swiftOrderingInstitution52A,

                              swiftOrderingInstitution52D_1,
                              swiftOrderingInstitution52D2,
                              swiftOrderingInstitution52D3,

                              swiftSendersCorrespondent53A,

                              swiftReceiversCorrespondent54A,
                              swiftBeneficiaryCustomer59_1,
                              swiftBeneficiaryCustomer59_2,
                              swiftBeneficiaryCustomer59_3,
                              swiftBeneficiaryCustomer59_4,
                              swiftBeneficiaryCustomer59_5,
                              swiftRemittanceInformation70_1,
                              swiftRemittanceInformation70_2,
                              swiftDetailsOfCharges71A,
                              swiftSendersCharges71F)
  RETURNING *;`;

async function fetchSwiftTransactions(
  ctx: SwiftContext,
  task: ListrTaskWrapper<unknown>,
  scraper: PoalimScraper,
  bankAccount: ScrapedAccount,
  logger: Logger,
) {
  task.output = `Getting transactions`;

  const foreignSwiftTransactions = await scraper.getForeignSwiftTransactions(bankAccount);

  if (!foreignSwiftTransactions.isValid) {
    if ('errors' in foreignSwiftTransactions) {
      logger.error(foreignSwiftTransactions.errors);
    }
    throw new Error(
      `Invalid swift data for ${bankAccount.branchNumber}:${bankAccount.accountNumber}`,
    );
  }

  if (
    !foreignSwiftTransactions.data?.swiftsList ||
    foreignSwiftTransactions.data.swiftsList.length === 0
  ) {
    task.skip('No data');
    ctx.transactions = [];
    return;
  }

  const swiftTransactions = foreignSwiftTransactions.data.swiftsList;

  ctx.transactions = swiftTransactions.filter(transaction => {
    if (transaction.currencyLongDescription === 'שקל חדש') {
      // skip local transactions
      logger.log(`
            ${transaction.startDate}
            ${transaction.amount}
            ${transaction.chargePartyName}
            is SHEKEL`);
      return false;
    }
    if (transaction.dataOriginCode !== 2) {
      // skip non-ready transactions
      logger.log(`Swift transaction
          ${transaction.startDate}
          ${transaction.amount}
          ${transaction.chargePartyName}
          is not ready yet`);
      // return false;
    }
    return true;
  });
}

async function isTransactionNew(
  transaction: SwiftTransaction,
  pool: Pool,
  logger: Logger,
): Promise<boolean> {
  try {
    const existingStatement = await checkForExistingSwiftTransaction.run(
      {
        transferCatenatedId: transaction.transferCatenatedId,
      },
      pool,
    );
    if (existingStatement.length > 0) {
      return false;
    }
    return true;
  } catch (error) {
    logger.error(error);
    throw new Error('Failed to check if swift transaction is new');
  }
}

function findElement(
  transaction: ForeignSwiftTransaction,
  attribute: string,
  defaultEmptyString: boolean = false,
) {
  return (
    transaction.swiftTransferDetailsList.find(
      element => element.swiftTransferAttributeCode === attribute,
    )?.swiftTransferAttributeValue ?? (defaultEmptyString ? ' ' : null)
  );
}

function findElementOffset(
  transaction: ForeignSwiftTransaction,
  attribute: string,
  offset: number,
  defaultEmptyString: boolean = false,
) {
  const index = transaction.swiftTransferDetailsList.findIndex(
    element => element.swiftTransferAttributeCode === attribute,
  );
  if (index === -1 || index + offset >= transaction.swiftTransferDetailsList.length) {
    return defaultEmptyString ? ' ' : null;
  }
  return (
    transaction.swiftTransferDetailsList[index + offset]?.swiftTransferAttributeValue ??
    (defaultEmptyString ? ' ' : null)
  );
}

async function normalizeTransaction(
  transaction: SwiftTransaction,
  bankAccount: ScrapedAccount,
  scraper: PoalimScraper,
  logger: Logger,
) {
  try {
    const foreignSwiftTransactionDetails = await scraper.getForeignSwiftTransaction(
      bankAccount,
      transaction.transferCatenatedId,
      transaction.dataOriginCode,
    );

    if (!foreignSwiftTransactionDetails.isValid) {
      if ('errors' in foreignSwiftTransactionDetails) {
        logger.error(foreignSwiftTransactionDetails.errors);
      }
      throw new Error(
        `Invalid swift data for ${transaction.transferCatenatedId} on ${bankAccount.branchNumber}:${bankAccount.accountNumber}`,
      );
    }

    if (!foreignSwiftTransactionDetails.data) {
      throw new Error(`No data for swift transaction ${transaction.transferCatenatedId}`);
    }

    const foreignSwiftTransaction = foreignSwiftTransactionDetails.data;

    const insertableTransaction: IInsertSwiftTransactionParams['switfTransactions'][number] = {
      accountNumber: bankAccount.accountNumber,
      branchNumber: bankAccount.branchNumber,
      bankNumber: bankAccount.bankNumber,

      startDate: transaction.startDate.toString(),
      formattedStartDate: transaction.formattedStartDate,
      swiftStatusCode: transaction.swiftStatusCode,
      swiftStatusDesc: transaction.swiftStatusDesc,
      amount: transaction.amount.toString(),
      currencyCodeCatenatedKey: transaction.currencyCodeCatenatedKey,
      currencyLongDescription: transaction.currencyLongDescription,
      chargePartyName: transaction.chargePartyName,
      referenceNumber: transaction.referenceNumber,
      transferCatenatedId: transaction.transferCatenatedId,
      dataOriginCode: transaction.dataOriginCode.toString(),

      swiftIsnSerialNumber:
        foreignSwiftTransactionDetails.data.swiftBankDetails.swiftIsnSerialNumber,
      swiftBankCode: foreignSwiftTransactionDetails.data.swiftBankDetails.swiftBankCode,
      orderCustomerName: foreignSwiftTransactionDetails.data.swiftBankDetails.orderCustomerName,
      beneficiaryEnglishStreetName:
        foreignSwiftTransactionDetails.data.swiftBankDetails.beneficiaryEnglishStreetName1,
      beneficiaryEnglishCityName:
        foreignSwiftTransactionDetails.data.swiftBankDetails.beneficiaryEnglishCityName1,
      beneficiaryEnglishCountryName:
        foreignSwiftTransactionDetails.data.swiftBankDetails.beneficiaryEnglishCountryName,

      swiftSendersReference20: findElement(foreignSwiftTransaction, ':20:'),
      swiftBankOperationCode23B: findElement(foreignSwiftTransaction, ':23B:'),
      swiftValueDateCurrencyAmount32A: findElement(foreignSwiftTransaction, ':32A:'),

      swiftCurrencyInstructedAmount33B: findElement(foreignSwiftTransaction, ':33B:', true),

      swiftOrderingCustomer50K1:
        findElementOffset(foreignSwiftTransaction, ':50K:', 0) ??
        findElementOffset(foreignSwiftTransaction, ':50F:', 0, true),
      swiftOrderingCustomer50K2:
        findElementOffset(foreignSwiftTransaction, ':50K:', 1) ??
        findElementOffset(foreignSwiftTransaction, ':50F:', 1, true),
      swiftOrderingCustomer50K3:
        findElementOffset(foreignSwiftTransaction, ':50K:', 2) ??
        findElementOffset(foreignSwiftTransaction, ':50F:', 2, true),
      swiftOrderingCustomer50K4:
        findElementOffset(foreignSwiftTransaction, ':50K:', 3) ??
        findElementOffset(foreignSwiftTransaction, ':50F:', 3, true),
      swiftOrderingCustomer50K5:
        findElementOffset(foreignSwiftTransaction, ':50K:', 4) ??
        findElementOffset(foreignSwiftTransaction, ':50F:', 4, true),

      swiftOrderingInstitution52A: findElement(foreignSwiftTransaction, ':52A:', true),

      swiftOrderingInstitution52D_1: findElementOffset(foreignSwiftTransaction, ':52D:', 0, true),
      swiftOrderingInstitution52D2: findElementOffset(foreignSwiftTransaction, ':52D:', 1, true),
      swiftOrderingInstitution52D3: findElementOffset(foreignSwiftTransaction, ':52D:', 2, true),

      swiftSendersCorrespondent53A:
        findElement(foreignSwiftTransaction, ':53B:') ??
        findElement(foreignSwiftTransaction, ':53A:', true),

      swiftReceiversCorrespondent54A: findElement(foreignSwiftTransaction, ':54A:', true),

      swiftBeneficiaryCustomer59_1:
        findElement(foreignSwiftTransaction, ':59:') ??
        findElement(foreignSwiftTransaction, ':59F:', true),
      swiftBeneficiaryCustomer59_2: findElement(foreignSwiftTransaction, ':59:')
        ? findElementOffset(foreignSwiftTransaction, ':59:', 1, true)
        : findElementOffset(foreignSwiftTransaction, ':59F:', 1, true),
      swiftBeneficiaryCustomer59_3: findElement(foreignSwiftTransaction, ':59:')
        ? findElementOffset(foreignSwiftTransaction, ':59:', 2, true)
        : findElementOffset(foreignSwiftTransaction, ':59F:', 2, true),
      swiftBeneficiaryCustomer59_4: findElement(foreignSwiftTransaction, ':59:')
        ? findElementOffset(foreignSwiftTransaction, ':59:', 3, true)
        : findElementOffset(foreignSwiftTransaction, ':59F:', 3, true),
      swiftBeneficiaryCustomer59_5: findElement(foreignSwiftTransaction, ':59:')
        ? findElementOffset(foreignSwiftTransaction, ':59:', 4, true)
        : findElementOffset(foreignSwiftTransaction, ':59F:', 4, true),

      swiftRemittanceInformation70_1: findElementOffset(foreignSwiftTransaction, ':70:', 0, true),
      swiftRemittanceInformation70_2: findElementOffset(foreignSwiftTransaction, ':70:', 1, true),

      swiftDetailsOfCharges71A: findElement(foreignSwiftTransaction, ':71A:', true),

      swiftSendersCharges71F: findElement(foreignSwiftTransaction, ':71F:', true),
    };

    return insertableTransaction;
  } catch (error) {
    logger.error(error);
    throw new Error('Failed to normalize swift transaction');
  }
}

export async function getSwiftTransactions(bankKey: string, account: ScrapedAccount) {
  const swiftKey = `${bankKey}_${account.branchNumber}_${account.accountNumber}_swift`;
  return new Listr<PoalimUserContext & { [bankKey: string]: { [swiftKey: string]: SwiftContext } }>(
    [
      {
        title: `Get Transactions`,
        task: async (ctx, task) => {
          const { scraper } = ctx[bankKey];
          ctx[bankKey][swiftKey] = {} as SwiftContext;
          await fetchSwiftTransactions(ctx[bankKey][swiftKey], task, scraper!, account, ctx.logger);
          task.title = `${task.title} (Got ${ctx[bankKey][swiftKey].transactions?.length} deposits)`;
        },
      },
      {
        title: `Check for New Transactions`,
        enabled: ctx => !!ctx[bankKey][swiftKey]?.transactions,
        skip: ctx =>
          ctx[bankKey][swiftKey].transactions?.length === 0 ? 'No transactions' : undefined,
        task: async (ctx, task) => {
          const { transactions = [] } = ctx[bankKey][swiftKey];
          const newTransactions: SwiftTransaction[] = [];
          for (const transaction of transactions) {
            if (await isTransactionNew(transaction, ctx.pool, ctx.logger)) {
              newTransactions.push(transaction);
            }
          }
          ctx[bankKey][swiftKey].newTransactions = newTransactions;
          task.title = `${task.title} (${ctx[bankKey][swiftKey].newTransactions?.length} new transactions)`;
        },
      },
      {
        title: `Insert Transactions`,
        enabled: ctx => !!ctx[bankKey][swiftKey]?.newTransactions,
        skip: ctx =>
          ctx[bankKey][swiftKey].newTransactions?.length === 0 ? 'No transactions' : undefined,
        task: async ctx => {
          try {
            const { newTransactions = [] } = ctx[bankKey][swiftKey];
            const insertableTransactions: IInsertSwiftTransactionParams['switfTransactions'][number][] =
              [];
            await Promise.all(
              newTransactions.map(async transaction => {
                insertableTransactions.push(
                  await normalizeTransaction(
                    transaction,
                    account,
                    ctx[bankKey].scraper!,
                    ctx.logger,
                  ),
                );
              }),
            );

            await insertSwiftTransaction.run(
              { switfTransactions: insertableTransactions },
              ctx.pool,
            );
          } catch (error) {
            ctx.logger.error(error);
            throw new Error('Failed to insert swift transactions');
          }
        },
      },
    ],
  );
}
