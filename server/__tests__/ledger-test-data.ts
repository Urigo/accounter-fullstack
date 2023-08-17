import { gql, testkit } from 'graphql-modules';
import { chargesModule } from 'server/src/modules/charges';
import { ChargesProvider } from 'server/src/modules/charges/providers/charges.provider';
import { commonModule } from 'server/src/modules/common';
import { documentsModule } from 'server/src/modules/documents';
import { DocumentsProvider } from 'server/src/modules/documents/providers/documents.provider';
import { ExchangeProvider } from 'server/src/modules/exchange-rates/providers/exchange.provider';
import { financialAccountsModule } from 'server/src/modules/financial-accounts';
import { financialEntitiesModule } from 'server/src/modules/financial-entities';
import { FinancialEntitiesProvider } from 'server/src/modules/financial-entities/providers/financial-entities.provider';
import { TaxCategoriesProvider } from 'server/src/modules/financial-entities/providers/tax-categories.provider';
import { ledgerModule } from 'server/src/modules/ledger';
import { tagsModule } from 'server/src/modules/tags';
import { TransactionsProvider } from 'server/src/modules/transactions/providers/transactions.provider';
import type { IGetChargesByIdsResult } from '../src/modules/charges/types';
import type { IGetAllDocumentsResult } from '../src/modules/documents/types';
import type { IGetExchangeRatesByDateResult } from '../src/modules/exchange-rates/types';
import { FinancialAccountsProvider } from '../src/modules/financial-accounts/providers/financial-accounts.provider';
import { IGetAllFinancialAccountsResult } from '../src/modules/financial-accounts/types';
import type {
  IGetAllTaxCategoriesResult,
  IGetFinancialEntitiesByIdsResult,
  IGetTaxCategoryByBusinessAndOwnerIDsResult,
} from '../src/modules/financial-entities/types';
import type { IGetTransactionsByIdsResult } from '../src/modules/transactions/types';

const ledgerCounterpartyHelper = (DbLedgerRecord: any, account: string) => {
  let counterpartyProto = undefined;
  switch (account) {
    case 'CreditAccount1':
      counterpartyProto = DbLedgerRecord.creditAccountID1;
      break;
    case 'CreditAccount2':
      counterpartyProto = DbLedgerRecord.creditAccountID2;
      break;
    case 'DebitAccount1':
      counterpartyProto = DbLedgerRecord.debitAccountID1;
      break;
    case 'DebitAccount2':
      counterpartyProto = DbLedgerRecord.debitAccountID2;
      break;
    default:
      throw new Error(`Invalid account type: ${account}`);
  }
  if (!counterpartyProto) return null;
  return typeof counterpartyProto === 'string'
    ? { id: counterpartyProto, __typeName: 'NamedCounterparty' }
    : { ...counterpartyProto, __typeName: 'TaxCategory' };
};

export function getDummyApp() {
  return testkit.testModule(ledgerModule, {
    inheritTypeDefs: [
      chargesModule,
      commonModule,
      documentsModule,
      financialAccountsModule,
      financialEntitiesModule,
      tagsModule,
    ],
    typeDefs: gql`
      type Query {
        chargesById(IDs: [ID!]!): [Charge!]!
        charge(id: ID!): Charge!
      }
      " represent a counterparty with a name "
      type NamedCounterparty implements Counterparty {
        name: String!
        id: UUID!
      }
    `,
    resolvers: {
      Query: {
        chargesById(_: unknown, { IDs }: { IDs: string[] }) {
          return IDs.map(id => charges[id]);
        },
        charge(_: unknown, { id }: { id: string }) {
          return charges[id];
        },
      },
      LedgerRecord: {
        creditAccount1: (DbLedgerRecord: any) =>
          ledgerCounterpartyHelper(DbLedgerRecord, 'CreditAccount1'),
        creditAccount2: (DbLedgerRecord: any) =>
          ledgerCounterpartyHelper(DbLedgerRecord, 'CreditAccount2'),
        debitAccount1: (DbLedgerRecord: any) =>
          ledgerCounterpartyHelper(DbLedgerRecord, 'DebitAccount1'),
        debitAccount2: (DbLedgerRecord: any) =>
          ledgerCounterpartyHelper(DbLedgerRecord, 'DebitAccount2'),
      },
      Counterparty: {
        __resolveType: (obj: any) => obj.__typeName,
      },
    },
    providers: [
      {
        provide: ChargesProvider,
        useValue: {
          getChargeByIdLoader: {
            load: (chargeId: string) => {
              return charges[chargeId];
            },
          },
        },
      },
      {
        provide: DocumentsProvider,
        useValue: {
          getDocumentsByChargeIdLoader: {
            load: (chargeId: string) => {
              return Object.values(documents).filter(d => d.charge_id_new === chargeId);
            },
          },
        },
      },
      {
        provide: TaxCategoriesProvider,
        useValue: {
          taxCategoryByBusinessAndOwnerIDsLoader: {
            load: ({ ownerID, businessID }: { ownerID: string; businessID: string }) => {
              return taxCategories.find(
                tc => tc.owner_id === ownerID && tc.business_id === businessID,
              );
            },
          },
          taxCategoryByNamesLoader: {
            load: async (name: string) => {
              return taxCategories.find(tc => tc.name === name);
            },
          },
          taxCategoryByChargeIDsLoader: {
            load: (chargeId: string) => {
              const charge = charges[chargeId];
              return taxCategories.find(tc => tc.id === charge.tax_category_id);
            },
          },
        },
      },
      {
        provide: ExchangeProvider,
        useValue: {
          getExchangeRates(date: Date) {
            return exchangeRates.find(r => r.exchange_date?.getTime() === date.getTime());
          },
        },
      },
      {
        provide: TransactionsProvider,
        useValue: {
          getTransactionsByChargeIDLoader: {
            load: (chargeId: string) => {
              return Object.values(transactions).filter(t => t.charge_id === chargeId);
            },
          },
        },
      },
      {
        provide: FinancialEntitiesProvider,
        useValue: {
          getFinancialEntityByIdLoader: {
            load: async (id: string) => {
              const business = businesses[id];
              return business;
            },
          },
        },
      },
      {
        provide: FinancialAccountsProvider,
        useValue: {
          getFinancialEntityByIdLoader: {
            load: async (id: string) => {
              const business = businesses[id];
              return business;
            },
          },
          getFinancialAccountByAccountIDLoader: {
            load: async (id: string) => {
              const account = financialAccounts[id];
              return account;
            },
          },
        },
      },
    ],
    replaceExtensions: true,
  });
}

const businesses: Record<string, IGetFinancialEntitiesByIdsResult> = {
  '2000': {
    name: 'Owner',
    id: '2000',
    address: null,
    address_hebrew: null,
    advance_tax_rate: null,
    bank_account_account_number: null,
    bank_account_bank_number: null,
    bank_account_branch_number: null,
    bank_account_IBAN: null,
    bank_account_swift: null,
    contract: null,
    country: 'Israel',
    email: null,
    hebrew_name: null,
    nikuim: null,
    no_invoices_required: false,
    password: null,
    phone_number: null,
    pinkas_social_security_2021: null,
    pinkas_social_security_2022: null,
    registration_date: null,
    suggestion_data: null,
    tax_nikuim_pinkas_number: null,
    tax_pinkas_number_2020: null,
    tax_siduri_number_2021: null,
    tax_siduri_number_2022: null,
    username_vat_website: null,
    vat_number: null,
    vat_report_cadence: null,
    website: null,
    website_login_screenshot: null,
    wizcloud_company_id: null,
    wizcloud_token: null,
    can_settle_with_receipt: false,
    sort_code: 100,
  },
  '2001': {
    name: 'Local Business 1',
    id: '2001',
    address: null,
    address_hebrew: null,
    advance_tax_rate: null,
    bank_account_account_number: null,
    bank_account_bank_number: null,
    bank_account_branch_number: null,
    bank_account_IBAN: null,
    bank_account_swift: null,
    contract: null,
    country: 'Israel',
    email: null,
    hebrew_name: null,
    nikuim: null,
    no_invoices_required: false,
    password: null,
    phone_number: null,
    pinkas_social_security_2021: null,
    pinkas_social_security_2022: null,
    registration_date: null,
    suggestion_data: null,
    tax_nikuim_pinkas_number: null,
    tax_pinkas_number_2020: null,
    tax_siduri_number_2021: null,
    tax_siduri_number_2022: null,
    username_vat_website: null,
    vat_number: null,
    vat_report_cadence: null,
    website: null,
    website_login_screenshot: null,
    wizcloud_company_id: null,
    wizcloud_token: null,
    can_settle_with_receipt: false,
    sort_code: 100,
  },
  '2002': {
    name: 'Local Business 2 (no invoices)',
    id: '2002',
    address: null,
    address_hebrew: null,
    advance_tax_rate: null,
    bank_account_account_number: null,
    bank_account_bank_number: null,
    bank_account_branch_number: null,
    bank_account_IBAN: null,
    bank_account_swift: null,
    contract: null,
    country: 'Israel',
    email: null,
    hebrew_name: null,
    nikuim: null,
    no_invoices_required: true,
    password: null,
    phone_number: null,
    pinkas_social_security_2021: null,
    pinkas_social_security_2022: null,
    registration_date: null,
    suggestion_data: null,
    tax_nikuim_pinkas_number: null,
    tax_pinkas_number_2020: null,
    tax_siduri_number_2021: null,
    tax_siduri_number_2022: null,
    username_vat_website: null,
    vat_number: null,
    vat_report_cadence: null,
    website: null,
    website_login_screenshot: null,
    wizcloud_company_id: null,
    wizcloud_token: null,
    can_settle_with_receipt: false,
    sort_code: 100,
  },
  '2003': {
    name: 'Foreign Business 1',
    id: '2003',
    address: null,
    address_hebrew: null,
    advance_tax_rate: null,
    bank_account_account_number: null,
    bank_account_bank_number: null,
    bank_account_branch_number: null,
    bank_account_IBAN: null,
    bank_account_swift: null,
    contract: null,
    country: 'FOREIGN',
    email: null,
    hebrew_name: null,
    nikuim: null,
    no_invoices_required: false,
    password: null,
    phone_number: null,
    pinkas_social_security_2021: null,
    pinkas_social_security_2022: null,
    registration_date: null,
    suggestion_data: null,
    tax_nikuim_pinkas_number: null,
    tax_pinkas_number_2020: null,
    tax_siduri_number_2021: null,
    tax_siduri_number_2022: null,
    username_vat_website: null,
    vat_number: null,
    vat_report_cadence: null,
    website: null,
    website_login_screenshot: null,
    wizcloud_company_id: null,
    wizcloud_token: null,
    can_settle_with_receipt: false,
    sort_code: 100,
  },
  '2004': {
    name: 'Foreign Business 2',
    id: '2004',
    address: null,
    address_hebrew: null,
    advance_tax_rate: null,
    bank_account_account_number: null,
    bank_account_bank_number: null,
    bank_account_branch_number: null,
    bank_account_IBAN: null,
    bank_account_swift: null,
    contract: null,
    country: 'FOREIGN',
    email: null,
    hebrew_name: null,
    nikuim: null,
    no_invoices_required: true,
    password: null,
    phone_number: null,
    pinkas_social_security_2021: null,
    pinkas_social_security_2022: null,
    registration_date: null,
    suggestion_data: null,
    tax_nikuim_pinkas_number: null,
    tax_pinkas_number_2020: null,
    tax_siduri_number_2021: null,
    tax_siduri_number_2022: null,
    username_vat_website: null,
    vat_number: null,
    vat_report_cadence: null,
    website: null,
    website_login_screenshot: null,
    wizcloud_company_id: null,
    wizcloud_token: null,
    can_settle_with_receipt: false,
    sort_code: 100,
  },
};

const financialAccounts: Record<string, IGetAllFinancialAccountsResult> = {
  '1': {
    id: '1',
    account_agreement_opening_date: null,
    account_closing_reason_code: null,
    account_deal_date: null,
    account_number: 'account 1#',
    account_update_date: null,
    bank_number: null,
    branch_number: null,
    branch_type_code: null,
    extended_bank_number: null,
    hashavshevet_account_eur: 'checking_eur',
    hashavshevet_account_gbp: 'checking_gbp',
    hashavshevet_account_ils: 'checking_ils',
    hashavshevet_account_usd: 'checking_usd',
    kod_harshaat_peilut: null,
    meteg_doar_net: null,
    mymail_entitlement_switch: null,
    owner: null,
    party_account_involvement_code: null,
    party_preferred_indication: null,
    private_business: 'business',
    service_authorization_desc: null,
  },
};

const charges: Record<string, IGetChargesByIdsResult> = {
  '1000': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1000',
    invoices_count: '1',
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description: 'ILS charge, one doc, one transaction, consistent dates and currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1001': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1001',
    invoices_count: '1',
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description: 'ILS charge, one doc, one transaction, diff dates, consistent currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1002': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1002',
    invoices_count: null,
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description: 'ILS charge, no doc, one transaction, consistent dates and currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1100': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1100',
    invoices_count: '1',
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description: 'USD charge, one doc, one transaction, consistent dates and currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1101': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1101',
    invoices_count: '1',
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description: 'USD charge, one doc, one transaction, diff dates, consistent currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1102': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1102',
    invoices_count: '1',
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description:
      'USD charge, one doc, one transaction, diff dates (transaction.debit_date), consistent currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1103': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1103',
    invoices_count: '1',
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description:
      'USD charge, one doc, one transaction, diff dates (transaction.event_date), consistent currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1104': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1104',
    invoices_count: '1',
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description:
      'USD charge, one doc, one transaction, diff dates - transaction first, consistent currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1105': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1105',
    invoices_count: null,
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description: 'USD charge, no doc, one transaction, consistent dates and currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1200': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1200',
    invoices_count: null,
    is_conversion: true,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '2',
    user_description: 'Conversion charge, no docs, two transaction, consistent dates',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1201': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1201',
    invoices_count: null,
    is_conversion: true,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '2',
    user_description: 'Conversion charge, no docs, two transaction, consistent dates, unbalanced',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1202': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1202',
    invoices_count: null,
    is_conversion: true,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '2',
    user_description: 'Conversion charge, no docs, two transaction, diff dates',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
  '1900': {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1900',
    invoices_count: '1',
    is_conversion: false,
    is_property: false,
    owner_id: businesses['2000'].id,
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    transactions_count: '1',
    user_description: 'ILS charge, one doc, one transaction,diff dates and currency',
    business_id: null,
    business_array: null,
    created_on: null,
    updated_on: null,
    documents_count: null,
    documents_currency: null,
    invalid_documents: null,
    invalid_transactions: null,
    transactions_currency: null,
    can_settle_with_receipt: null,
    tax_category_id: '1',
  },
};

const documents: Record<string, IGetAllDocumentsResult> = {
  '3000': {
    id: '3000',
    charge_id: null,
    charge_id_new: charges['1000'].id,
    created_at: new Date(),
    creditor: null,
    creditor_id: businesses['2001'].id,
    currency_code: 'ILS',
    date: new Date('2020-01-01'),
    debtor: null,
    debtor_id: businesses['2000'].id,
    description: null,
    file_url: null,
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: 117_000,
    type: 'INVOICE',
    vat_amount: 17_000,
  },
  '3001': {
    id: '3001',
    charge_id: null,
    charge_id_new: charges['1001'].id,
    created_at: new Date(),
    creditor: null,
    creditor_id: businesses['2001'].id,
    currency_code: 'ILS',
    date: new Date('2020-01-01'),
    debtor: null,
    debtor_id: businesses['2000'].id,
    description: null,
    file_url: null,
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: 117_000,
    type: 'INVOICE',
    vat_amount: 17_000,
  },
  '3100': {
    id: '3100',
    charge_id: null,
    charge_id_new: charges['1100'].id,
    created_at: new Date(),
    creditor: null,
    creditor_id: businesses['2003'].id,
    currency_code: 'USD',
    date: new Date('2020-01-01'),
    debtor: null,
    debtor_id: businesses['2000'].id,
    description: null,
    file_url: null,
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: -100_000,
    type: 'INVOICE',
    vat_amount: 0,
  },
  '3101': {
    id: '3101',
    charge_id: null,
    charge_id_new: charges['1101'].id,
    created_at: new Date(),
    creditor: null,
    creditor_id: businesses['2003'].id,
    currency_code: 'USD',
    date: new Date('2020-01-01'),
    debtor: null,
    debtor_id: businesses['2000'].id,
    description: null,
    file_url: null,
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: -100_000,
    type: 'INVOICE',
    vat_amount: 0,
  },
  '3102': {
    id: '3102',
    charge_id: null,
    charge_id_new: charges['1102'].id,
    created_at: new Date(),
    creditor: null,
    creditor_id: businesses['2003'].id,
    currency_code: 'USD',
    date: new Date('2020-01-01'),
    debtor: null,
    debtor_id: businesses['2000'].id,
    description: null,
    file_url: null,
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: -100_000,
    type: 'INVOICE',
    vat_amount: 0,
  },
  '3103': {
    id: '3103',
    charge_id: null,
    charge_id_new: charges['1103'].id,
    created_at: new Date(),
    creditor: null,
    creditor_id: businesses['2003'].id,
    currency_code: 'USD',
    date: new Date('2020-01-01'),
    debtor: null,
    debtor_id: businesses['2000'].id,
    description: null,
    file_url: null,
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: -100_000,
    type: 'INVOICE',
    vat_amount: 0,
  },
  '3104': {
    id: '3104',
    charge_id: null,
    charge_id_new: charges['1104'].id,
    created_at: new Date(),
    creditor: null,
    creditor_id: businesses['2003'].id,
    currency_code: 'USD',
    date: new Date('2020-01-02'),
    debtor: null,
    debtor_id: businesses['2000'].id,
    description: null,
    file_url: null,
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: -100_000,
    type: 'INVOICE',
    vat_amount: 0,
  },
  '3900': {
    id: '3900',
    charge_id: null,
    charge_id_new: charges['1900'].id,
    created_at: new Date(),
    creditor: null,
    creditor_id: businesses['2000'].id,
    currency_code: 'USD',
    date: new Date('2020-01-01'),
    debtor: null,
    debtor_id: businesses['2001'].id,
    description: null,
    file_url: null,
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: 100_000,
    type: 'INVOICE',
    vat_amount: 17_000,
  },
};

const transactions: Record<string, IGetTransactionsByIdsResult> = {
  '4000': {
    id: '4000',
    source_description: 'Description for transaction 4000',
    account_id: '1',
    amount: '-117000',
    business_id: businesses['2001'].id,
    charge_id: charges['1000'].id,
    currency: 'ILS',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4001': {
    id: '4001',
    source_description: 'Description for transaction 4001',
    account_id: '1',
    amount: '-117000',
    business_id: businesses['2001'].id,
    charge_id: charges['1001'].id,
    currency: 'ILS',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4002': {
    id: '4002',
    source_description: 'Description for transaction 4002',
    account_id: '1',
    amount: '-117000',
    business_id: businesses['2002'].id,
    charge_id: charges['1002'].id,
    currency: 'ILS',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4100': {
    id: '4100',
    source_description: 'Description for transaction 4100',
    account_id: '1',
    amount: '-100000',
    business_id: businesses['2003'].id,
    charge_id: charges['1100'].id,
    currency: 'USD',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4101': {
    id: '4101',
    source_description: 'Description for transaction 4100',
    account_id: '1',
    amount: '-100000',
    business_id: businesses['2003'].id,
    charge_id: charges['1101'].id,
    currency: 'USD',
    current_balance: '0',
    debit_date: new Date('2020-01-02'),
    event_date: new Date('2020-01-02'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4102': {
    id: '4102',
    source_description: 'Description for transaction 4100',
    account_id: '1',
    amount: '-100000',
    business_id: businesses['2003'].id,
    charge_id: charges['1102'].id,
    currency: 'USD',
    current_balance: '0',
    debit_date: new Date('2020-01-02'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4103': {
    id: '4103',
    source_description: 'Description for transaction 4100',
    account_id: '1',
    amount: '-100000',
    business_id: businesses['2003'].id,
    charge_id: charges['1103'].id,
    currency: 'USD',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-02'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4104': {
    id: '4104',
    source_description: 'Description for transaction 4100',
    account_id: '1',
    amount: '-100000',
    business_id: businesses['2003'].id,
    charge_id: charges['1104'].id,
    currency: 'USD',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4105': {
    id: '4105',
    source_description: 'Description for transaction 4105',
    account_id: '1',
    amount: '-100000',
    business_id: businesses['2004'].id,
    charge_id: charges['1105'].id,
    currency: 'USD',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '2',
    source_reference: 'ref 2',
    created_on: null,
    updated_on: null,
  },
  '4200a': {
    id: '4200a',
    source_description: 'Description for transaction 4200a',
    account_id: '1',
    amount: '100000',
    business_id: businesses['2004'].id,
    charge_id: charges['1200'].id,
    currency: 'EUR',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4200b': {
    id: '4200b',
    source_description: 'Description for transaction 4200b',
    account_id: '1',
    amount: '-200000',
    business_id: businesses['2003'].id,
    charge_id: charges['1200'].id,
    currency: 'ILS',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4201a': {
    id: '4201a',
    source_description: 'Description for transaction 4201a',
    account_id: '1',
    amount: '100000',
    business_id: businesses['2004'].id,
    charge_id: charges['1201'].id,
    currency: 'EUR',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4201b': {
    id: '4201b',
    source_description: 'Description for transaction 4201b',
    account_id: '1',
    amount: '-100000',
    business_id: businesses['2003'].id,
    charge_id: charges['1201'].id,
    currency: 'ILS',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4202a': {
    id: '4202a',
    source_description: 'Description for transaction 4202a',
    account_id: '1',
    amount: '100000',
    business_id: businesses['2004'].id,
    charge_id: charges['1202'].id,
    currency: 'EUR',
    current_balance: '0',
    debit_date: new Date('2020-01-02'),
    event_date: new Date('2020-01-02'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4202b': {
    id: '4202b',
    source_description: 'Description for transaction 4202b',
    account_id: '1',
    amount: '-250000',
    business_id: businesses['2003'].id,
    charge_id: charges['1202'].id,
    currency: 'ILS',
    current_balance: '0',
    debit_date: new Date('2020-01-01'),
    event_date: new Date('2020-01-01'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
  '4900': {
    id: '4900',
    source_description: 'Description for transaction 4900',
    account_id: '1',
    amount: '-117000',
    business_id: businesses['2001'].id,
    charge_id: charges['1900'].id,
    currency: 'ILS',
    current_balance: '0',
    debit_date: new Date('2020-01-02'),
    event_date: new Date('2020-01-02'),
    source_id: '1',
    source_reference: 'ref 1',
    created_on: null,
    updated_on: null,
  },
};

const taxCategories: Array<
  IGetAllTaxCategoriesResult &
    Partial<Pick<IGetTaxCategoryByBusinessAndOwnerIDsResult, 'business_id' | 'owner_id'>>
> = [
  {
    id: '1',
    owner_id: businesses['2000'].id,
    business_id: businesses['2001'].id,
    name: 'Tax Category 1',
    hashavshevet_name: 'קטגוריית מס 1',
    sort_code: 100,
  },
  {
    id: '2',
    owner_id: businesses['2000'].id,
    business_id: businesses['2002'].id,
    name: 'Tax Category 2',
    hashavshevet_name: 'קטגוריית מס 2',
    sort_code: 200,
  },
  {
    id: '3',
    owner_id: businesses['2000'].id,
    business_id: businesses['2003'].id,
    name: 'Tax Category 3',
    hashavshevet_name: 'קטגוריית מס 3',
    sort_code: 300,
  },
  {
    id: '4',
    owner_id: businesses['2000'].id,
    business_id: businesses['2004'].id,
    name: 'Tax Category 4',
    hashavshevet_name: 'קטגוריית מס 4',
    sort_code: 400,
  },
  {
    id: '900',
    name: 'Exchange Rates',
    hashavshevet_name: 'שער',
    sort_code: 990,
  },
  {
    id: '901',
    name: 'מעמחוז',
    hashavshevet_name: 'מעמחוז',
    sort_code: 510,
  },
  {
    id: '902',
    name: 'checking_eur',
    hashavshevet_name: 'checking_eur',
    sort_code: 110,
  },
  {
    id: '903',
    name: 'checking_gbp',
    hashavshevet_name: 'checking_gbp',
    sort_code: 110,
  },
  {
    id: '904',
    name: 'checking_ils',
    hashavshevet_name: 'checking_ils',
    sort_code: 110,
  },
  {
    id: '905',
    name: 'checking_usd',
    hashavshevet_name: 'checking_usd',
    sort_code: 110,
  },
];

const exchangeRates: Array<IGetExchangeRatesByDateResult> = [
  {
    exchange_date: new Date('2020-01-01'),
    usd: '1',
    eur: '2',
    gbp: '3',
  },
  {
    exchange_date: new Date('2020-01-02'),
    usd: '1.5',
    eur: '2.5',
    gbp: '3.5',
  },
  {
    exchange_date: new Date('2020-01-03'),
    usd: null,
    eur: null,
    gbp: null,
  },
];

export const fetchChargeQuery = gql`
  query Test($id: ID!) {
    charge(id: $id) {
      ledgerRecords {
        ... on LedgerRecords {
          records {
            creditAccount1 {
              id
            }
            creditAccount2 {
              id
            }
            creditAmount1 {
              formatted
            }
            creditAmount2 {
              formatted
            }
            debitAccount1 {
              id
            }
            debitAccount2 {
              id
            }
            debitAmount1 {
              formatted
            }
            debitAmount2 {
              formatted
            }
            description
            invoiceDate
            localCurrencyCreditAmount1 {
              formatted
            }
            localCurrencyCreditAmount2 {
              formatted
            }
            localCurrencyDebitAmount1 {
              formatted
            }
            localCurrencyDebitAmount2 {
              formatted
            }
            reference1
            valueDate
          }
        }
        ... on CommonError {
          message
        }
      }
    }
  }
`;

export const fetchChargesQuery = gql`
  query Test2($IDs: [ID!]!) {
    chargesById(IDs: $IDs) {
      ledgerRecords {
        ... on LedgerRecords {
          records {
            creditAccount1 {
              id
            }
            creditAccount2 {
              id
            }
            creditAmount1 {
              formatted
            }
            creditAmount2 {
              formatted
            }
            debitAccount1 {
              id
            }
            debitAccount2 {
              id
            }
            debitAmount1 {
              formatted
            }
            debitAmount2 {
              formatted
            }
            description
            invoiceDate
            localCurrencyCreditAmount1 {
              formatted
            }
            localCurrencyCreditAmount2 {
              formatted
            }
            localCurrencyDebitAmount1 {
              formatted
            }
            localCurrencyDebitAmount2 {
              formatted
            }
            reference1
            valueDate
          }
        }
        ... on CommonError {
          message
        }
      }
    }
  }
`;
