import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { FinancialBankAccountsProvider } from '../providers/financial-bank-accounts.provider.js';
import type {
  FinancialAccountsModule,
  IGetFinancialAccountsByOwnerIdsResult,
  IGetFinancialBankAccountsByIdsResult,
} from '../types.js';
import { commonFinancialAccountFields } from './common.js';

async function getBankAccountByFinancialAccount(
  financialAccount: IGetFinancialAccountsByOwnerIdsResult,
  injector: Injector,
): Promise<IGetFinancialBankAccountsByIdsResult> {
  const bankAccount = await injector
    .get(FinancialBankAccountsProvider)
    .getFinancialBankAccountByIdLoader.load(financialAccount.id);
  if (!bankAccount) {
    throw new GraphQLError('Bank account not found');
  }
  return bankAccount;
}

export const financialBankAccountsResolvers: FinancialAccountsModule.Resolvers = {
  BankFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'BANK_ACCOUNT',
    ...commonFinancialAccountFields,
    accountNumber: DbAccount => DbAccount.account_number,
    bankNumber: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.bank_number,
      ),
    branchNumber: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.branch_number,
      ),
    iban: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(bankAccount => bankAccount.iban),
    name: async (DbAccount, _, { injector }) =>
      DbAccount.account_name ??
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => `${bankAccount.bank_number}-${DbAccount.account_number}`,
      ),

    extendedBankNumber: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.extended_bank_number,
      ),
    partyPreferredIndication: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.party_preferred_indication,
      ),
    partyAccountInvolvementCode: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.party_account_involvement_code,
      ),
    accountDealDate: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.account_deal_date,
      ),
    accountUpdateDate: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.account_update_date,
      ),
    metegDoarNet: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.meteg_doar_net,
      ),
    kodHarshaatPeilut: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.kod_harshaat_peilut,
      ),
    accountClosingReasonCode: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.account_closing_reason_code,
      ),
    accountAgreementOpeningDate: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.account_agreement_opening_date,
      ),
    serviceAuthorizationDesc: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.service_authorization_desc,
      ),
    branchTypeCode: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.branch_type_code,
      ),
    mymailEntitlementSwitch: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.mymail_entitlement_switch,
      ),
    productLabel: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => bankAccount.product_label,
      ),
  },
};
