import Listr from 'listr';
import type { Pool } from 'pg';
import type { AccountDataSchema } from '@accounter/modern-poalim-scraper/dist/__generated__/accountDataSchema.js';
import { sql } from '@pgtyped/runtime';
import { getTableColumns, insertFinancialAccount } from '../../helpers/sql.js';
import type {
  IGetAllFinancialAccountsQuery,
  IGetAllFinancialAccountsResult,
} from '../../helpers/types.js';
import { PoalimContext } from './index.js';

export type ScrapedAccount = AccountDataSchema[number];

type AccountsContext = {
  scrapedAccounts: ScrapedAccount[];
  dbAccounts: IGetAllFinancialAccountsResult[];
  acceptedBankAccounts?: number[];
};

const getAllFinancialAccounts = sql<IGetAllFinancialAccountsQuery>`
  SELECT *
  FROM accounter_schema.financial_accounts
  WHERE type = 'BANK_ACCOUNT'
    AND bank_number = 12;`;

export async function getPoalimAccounts(pool: Pool, parentCtx: PoalimContext) {
  return new Listr<AccountsContext>([
    {
      title: 'Get Accounts from Bank',
      task: async (ctx, task) => {
        const accounts = await parentCtx.scraper!.getAccountsData();

        if (!accounts.isValid) {
          console.log(
            `Poalim accounts validation errors: `,
            'errors' in accounts ? accounts.errors : null,
          );
        }

        if (!accounts.data) {
          ctx.scrapedAccounts = [];
          task.skip('No accounts data');
          return;
        }

        ctx.scrapedAccounts = accounts.data.filter(
          account =>
            parentCtx.acceptedAccountNumbers.length === 0 ||
            parentCtx.acceptedAccountNumbers.includes(account.accountNumber),
        );
      },
    },
    {
      title: 'Get Accounts from Datsabase',
      task: async ctx => {
        try {
          const accounts = await getAllFinancialAccounts.run(undefined, pool);

          ctx.dbAccounts = accounts;
        } catch (error) {
          console.error(error);
          throw new Error('Failed to get accounts from database');
        }
      },
    },
    {
      title: 'Get metadata from DB',
      task: async () => {
        try {
          parentCtx.columns ??= {};
          await Promise.all(
            ['ils', 'eur', 'usd', 'gbp'].map(async currency => {
              parentCtx.columns![`poalim_${currency}_account_transactions`] =
                await getTableColumns.run(
                  { tableName: `poalim_${currency}_account_transactions` },
                  pool,
                );
            }),
          );
        } catch (error) {
          console.error(error);
          throw new Error('Error on getting columns info');
        }
      },
    },
    {
      title: 'Validate Accounts',
      task: async (ctx, task) => {
        for (const account of ctx.scrapedAccounts) {
          if (
            parentCtx.acceptedAccountNumbers.length &&
            !parentCtx.acceptedAccountNumbers.includes(account.accountNumber)
          ) {
            throw new Error(`Poalim Account ${account.accountNumber} is not accepted`);
          }

          const dbAccount = ctx.dbAccounts.find(
            dbAccount =>
              dbAccount.branch_number === account.branchNumber &&
              dbAccount.account_number === account.accountNumber.toString(),
          );

          if (dbAccount) {
            // Check for differences
            const diffs: (keyof AccountDataSchema[number])[] = [];
            if (dbAccount.account_agreement_opening_date !== account.accountAgreementOpeningDate) {
              diffs.push('accountAgreementOpeningDate');
            }
            if (dbAccount.account_closing_reason_code !== account.accountClosingReasonCode) {
              diffs.push('accountClosingReasonCode');
            }
            if (dbAccount.account_deal_date !== account.accountDealDate) {
              diffs.push('accountDealDate');
            }
            if (dbAccount.account_update_date !== account.accountUpdateDate) {
              diffs.push('accountUpdateDate');
            }
            if (dbAccount.bank_number !== account.bankNumber) {
              diffs.push('bankNumber');
            }
            if (dbAccount.branch_number !== account.branchNumber) {
              diffs.push('branchNumber');
            }
            if (dbAccount.branch_type_code !== account.branchTypeCode) {
              diffs.push('branchTypeCode');
            }
            if (dbAccount.extended_bank_number !== account.extendedBankNumber) {
              diffs.push('extendedBankNumber');
            }
            if (dbAccount.kod_harshaat_peilut !== account.kodHarshaatPeilut) {
              diffs.push('kodHarshaatPeilut');
            }
            if (dbAccount.mymail_entitlement_switch !== account.mymailEntitlementSwitch) {
              diffs.push('mymailEntitlementSwitch');
            }
            if (dbAccount.party_account_involvement_code !== account.partyAccountInvolvementCode) {
              diffs.push('partyAccountInvolvementCode');
            }
            if (dbAccount.party_preferred_indication !== account.partyPreferredIndication) {
              diffs.push('partyPreferredIndication');
            }
            if (
              (dbAccount.product_label || account.productLabel) &&
              dbAccount.product_label !== account.productLabel
            ) {
              diffs.push('productLabel');
            }
            if (
              (dbAccount.service_authorization_desc || account.serviceAuthorizationDesc) &&
              dbAccount.service_authorization_desc !== account.serviceAuthorizationDesc
            ) {
              diffs.push('serviceAuthorizationDesc');
            }

            if (diffs.length) {
              throw new Error(`Poalim Account ${account.accountNumber} diffs: ${diffs.join(', ')}`);
            }
          } else {
            // Insert new account
            try {
              const [res] = await insertFinancialAccount.run(
                {
                  accountNumber: account.accountNumber.toString(),
                  type: 'BANK_ACCOUNT',
                  owner: null,
                  bankNumber: account.bankNumber,
                  branchNumber: account.branchNumber,
                  extendedBankNumber: account.extendedBankNumber,
                  partyPreferredIndication: account.partyPreferredIndication,
                  partyAccountInvolvementCode: account.partyAccountInvolvementCode,
                  accountDealDate: account.accountDealDate,
                  accountUpdateDate: account.accountUpdateDate,
                  metegDoarNet: account.metegDoarNet,
                  kodHarshaatPeilut: account.kodHarshaatPeilut,
                  accountClosingReasonCode: account.accountClosingReasonCode,
                  accountAgreementOpeningDate: account.accountAgreementOpeningDate,
                  serviceAuthorizationDesc: account.serviceAuthorizationDesc,
                  branchTypeCode: account.branchTypeCode,
                  mymailEntitlementSwitch: account.mymailEntitlementSwitch,
                  productLabel: account.productLabel,
                  privateBusiness: null,
                },
                pool,
              );
              task.output = `Poalim Account ${res.account_number} inserted`;
            } catch (error) {
              console.error(error);
              throw new Error(`Poalim Account ${account.accountNumber} insert failed`);
            }
          }
        }
        parentCtx.accounts = ctx.scrapedAccounts;
      },
    },
  ]);
}
