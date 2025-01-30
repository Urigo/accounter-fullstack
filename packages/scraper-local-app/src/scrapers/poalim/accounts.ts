import Listr from 'listr';
import type { AccountDataSchema } from '@accounter/modern-poalim-scraper/dist/__generated__/accountDataSchema.js';
import { sql } from '@pgtyped/runtime';
import { getTableColumns, insertFinancialAccount } from '../../helpers/sql.js';
import type {
  IGetAllFinancialAccountsQuery,
  IGetAllFinancialAccountsResult,
} from '../../helpers/types.js';
import { MainContext } from '../../index.js';
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

export async function getPoalimAccounts(bankKey: string) {
  return new Listr<MainContext & { [bankKey: string]: PoalimContext & AccountsContext }>([
    {
      title: 'Get Accounts from Bank',
      task: async (ctx, task) => {
        const accounts = await ctx[bankKey].scraper!.getAccountsData();

        if (!accounts.isValid) {
          ctx.logger.log(
            `Poalim accounts validation errors: `,
            'errors' in accounts ? accounts.errors : null,
          );
        }

        if (!accounts.data) {
          ctx[bankKey].scrapedAccounts = [];
          task.skip('No accounts data');
          return;
        }

        ctx[bankKey].scrapedAccounts = accounts.data.filter(
          account =>
            ctx[bankKey].acceptedAccountNumbers.length === 0 ||
            ctx[bankKey].acceptedAccountNumbers.includes(account.accountNumber),
        );
      },
    },
    {
      title: 'Get Accounts from Datsabase',
      task: async ctx => {
        try {
          const accounts = await getAllFinancialAccounts.run(undefined, ctx.pool);

          ctx[bankKey].dbAccounts = accounts;
        } catch (error) {
          ctx.logger.error(error);
          throw new Error('Failed to get accounts from database');
        }
      },
    },
    {
      title: 'Get metadata from DB',
      task: async ctx => {
        try {
          ctx[bankKey].columns ??= {};
          await Promise.all(
            ['ils', 'eur', 'usd', 'gbp', 'cad'].map(async currency => {
              ctx[bankKey].columns![`poalim_${currency}_account_transactions`] =
                await getTableColumns.run(
                  { tableName: `poalim_${currency}_account_transactions` },
                  ctx.pool,
                );
            }),
          );
        } catch (error) {
          ctx.logger.error(error);
          throw new Error('Error on getting columns info');
        }
      },
    },
    {
      title: 'Validate Accounts',
      task: async (ctx, task) => {
        for (const account of ctx[bankKey].scrapedAccounts) {
          if (
            ctx[bankKey].acceptedAccountNumbers.length &&
            !ctx[bankKey].acceptedAccountNumbers.includes(account.accountNumber)
          ) {
            throw new Error(`Poalim Account ${account.accountNumber} is not accepted`);
          }

          const dbAccount = ctx[bankKey].dbAccounts.find(
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
                ctx.pool,
              );
              task.output = `Poalim Account ${res.account_number} inserted`;
            } catch (error) {
              ctx.logger.error(error);
              throw new Error(`Poalim Account ${account.accountNumber} insert failed`);
            }
          }
        }
        ctx[bankKey].accounts = ctx[bankKey].scrapedAccounts;
      },
    },
  ]);
}
