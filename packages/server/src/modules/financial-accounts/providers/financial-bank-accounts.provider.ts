import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBankAccountParams,
  IDeleteBankAccountQuery,
  IGetAllFinancialBankAccountsQuery,
  IGetAllFinancialBankAccountsResult,
  IGetFinancialBankAccountsByIdsQuery,
  IInsertBankAccountsParams,
  IInsertBankAccountsQuery,
  IUpdateBankAccountParams,
  IUpdateBankAccountQuery,
} from '../types.js';

const getFinancialBankAccountsByIds = sql<IGetFinancialBankAccountsByIdsQuery>`
  SELECT *
  FROM accounter_schema.financial_bank_accounts
  WHERE id IN $$bankAccountIds;`;

const getAllFinancialBankAccounts = sql<IGetAllFinancialBankAccountsQuery>`
  SELECT *
  FROM accounter_schema.financial_bank_accounts;`;

const updateBankAccount = sql<IUpdateBankAccountQuery>`
  UPDATE accounter_schema.financial_bank_accounts
  SET
  bank_number =COALESCE(
    $bankNumber,
    bank_number
  ),
  branch_number =COALESCE(
    $branchNumber,
    branch_number
  ),
  extended_bank_number =COALESCE(
    $extendedBankNumber,
    extended_bank_number
  ),
  party_preferred_indication =COALESCE(
    $partyPreferredIndication,
    party_preferred_indication
  ),
  party_account_involvement_code =COALESCE(
    $partyAccountInvolvementCode,
    party_account_involvement_code
  ),
  account_deal_date =COALESCE(
    $accountDealDate,
    account_deal_date
  ),
  account_update_date =COALESCE(
    $accountUpdateDate,
    account_update_date
  ),
  meteg_doar_net =COALESCE(
    $metegDoarNet,
    meteg_doar_net
  ),
  kod_harshaat_peilut =COALESCE(
    $kodHarshaatPeilut,
    kod_harshaat_peilut
  ),
  account_closing_reason_code =COALESCE(
    $accountClosingReasonCode,
    account_closing_reason_code
  ),
  account_agreement_opening_date =COALESCE(
    $accountAgreementOpeningDate,
    account_agreement_opening_date
  ),
  service_authorization_desc =COALESCE(
    $serviceAuthorizationDesc,
    service_authorization_desc
  ),
  branch_type_code =COALESCE(
    $branchTypeCode,
    branch_type_code
  ),
  mymail_entitlement_switch =COALESCE(
    $mymailEntitlementSwitch,
    mymail_entitlement_switch
  ),
  product_label =COALESCE(
    $productLabel,
    product_label
  )
  WHERE
    id = $bankAccountId
  RETURNING *;
`;

const insertBankAccounts = sql<IInsertBankAccountsQuery>`
  INSERT INTO accounter_schema.financial_bank_accounts (
    bank_number,
    branch_number,
    extended_bank_number,
    party_preferred_indication,
    party_account_involvement_code,
    account_deal_date,
    account_update_date,
    meteg_doar_net,
    kod_harshaat_peilut,
    account_closing_reason_code,
    account_agreement_opening_date,
    service_authorization_desc,
    branch_type_code,
    mymail_entitlement_switch,
    product_label
  )
  VALUES $$bankAccounts(
    bankNumber,
    branchNumber,
    extendedBankNumber,
    partyPreferredIndication,
    partyAccountInvolvementCode,
    accountDealDate,
    accountUpdateDate,
    metegDoarNet,
    kodHarshaatPeilut,
    accountClosingReasonCode,
    accountAgreementOpeningDate,
    serviceAuthorizationDesc,
    branchTypeCode,
    mymailEntitlementSwitch,
    productLabel
  )
  RETURNING *;`;

const deleteBankAccount = sql<IDeleteBankAccountQuery>`
    DELETE FROM accounter_schema.financial_bank_accounts
    WHERE id = $bankAccountId
    RETURNING id;
  `;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialBankAccountsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchFinancialBankAccountsByIds(bankAccountIds: readonly string[]) {
    const accounts = await getFinancialBankAccountsByIds.run(
      {
        bankAccountIds,
      },
      this.dbProvider,
    );
    return bankAccountIds.map(id => accounts.find(account => account.id === id));
  }

  public getFinancialBankAccountByIdLoader = new DataLoader(
    (bankAccountIds: readonly string[]) => this.batchFinancialBankAccountsByIds(bankAccountIds),
    {
      cacheKeyFn: key => `bank-account-id-${key}`,
      cacheMap: this.cache,
    },
  );

  public getAllFinancialBankAccounts() {
    const cached = this.cache.get<IGetAllFinancialBankAccountsResult[]>('all-bank-accounts');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllFinancialBankAccounts.run(undefined, this.dbProvider).then(res => {
      this.cache.set('all-bank-accounts', res);
      res.map(account => {
        this.cache.set(`bank-account-id-${account.id}`, account);
      });
      return res;
    });
  }

  public async updateBankAccount(params: IUpdateBankAccountParams) {
    if (params.bankAccountId) {
      this.invalidateById(params.bankAccountId);
      const bankAccount = await this.getFinancialBankAccountByIdLoader.load(params.bankAccountId);
      if (bankAccount?.id) {
        this.cache.set(`bank-account-id-${bankAccount?.id}`, bankAccount);
      }
      return bankAccount;
    }
    return updateBankAccount.run(params, this.dbProvider);
  }

  public async deleteBankAccount(params: IDeleteBankAccountParams) {
    if (params.bankAccountId) {
      this.invalidateById(params.bankAccountId);
    }
    return deleteBankAccount.run(params, this.dbProvider);
  }

  public async insertBankAccounts(params: IInsertBankAccountsParams) {
    this.cache.delete('all-bank-accounts');
    return insertBankAccounts.run(params, this.dbProvider);
  }

  public invalidateById(bankAccountId: string) {
    this.cache.delete(`bank-account-id-${bankAccountId}`);
    this.cache.delete('all-bank-accounts');
  }

  public clearCache() {
    this.cache.clear();
  }
}
