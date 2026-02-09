import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
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
  SELECT id,
    bank_number,
    branch_number,
    iban,
    swift_code,
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
  FROM accounter_schema.financial_bank_accounts
  WHERE id IN $$bankAccountIds;`;

const getAllFinancialBankAccounts = sql<IGetAllFinancialBankAccountsQuery>`
  SELECT id,
    bank_number,
    branch_number,
    iban,
    swift_code,
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
  iban =COALESCE(
    $iban,
    iban
  ),
  swift_code =COALESCE(
    $swiftCode,
    swift_code
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
    iban,
    swift_code,
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
    iban,
    swiftCode,
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
  scope: Scope.Operation,
  global: true,
})
export class FinancialBankAccountsProvider {
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

  public getFinancialBankAccountByIdLoader = new DataLoader((bankAccountIds: readonly string[]) =>
    this.batchFinancialBankAccountsByIds(bankAccountIds),
  );

  private allFinancialBankAccountsCache: Promise<IGetAllFinancialBankAccountsResult[]> | null =
    null;
  public getAllFinancialBankAccounts() {
    if (this.allFinancialBankAccountsCache) {
      return this.allFinancialBankAccountsCache;
    }
    const result = getAllFinancialBankAccounts.run(undefined, this.dbProvider).then(accounts => {
      accounts.map(account => {
        this.getFinancialBankAccountByIdLoader.prime(account.id, account);
      });
      return accounts;
    });
    this.allFinancialBankAccountsCache = result;
    return result;
  }

  public async updateBankAccount(params: IUpdateBankAccountParams) {
    const updatedAccounts = await updateBankAccount.run(params, this.dbProvider);
    const updatedAccount = updatedAccounts[0];
    if (updatedAccount) {
      this.invalidateById(updatedAccount.id);
    }
    return updatedAccount;
  }

  public async deleteBankAccount(params: IDeleteBankAccountParams) {
    if (params.bankAccountId) {
      this.invalidateById(params.bankAccountId);
    }
    return deleteBankAccount.run(params, this.dbProvider);
  }

  public async insertBankAccounts(params: IInsertBankAccountsParams) {
    this.allFinancialBankAccountsCache = null;
    return insertBankAccounts.run(params, this.dbProvider);
  }

  public invalidateById(bankAccountId: string) {
    this.getFinancialBankAccountByIdLoader.clear(bankAccountId);
    this.allFinancialBankAccountsCache = null;
  }

  public clearCache() {
    this.getFinancialBankAccountByIdLoader.clearAll();
    this.allFinancialBankAccountsCache = null;
  }
}
