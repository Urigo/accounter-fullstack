import { Application, gql, testkit } from 'graphql-modules';
import 'reflect-metadata';
import { chargesModule } from 'server/src/modules/charges';
import { ChargesProvider } from 'server/src/modules/charges/providers/charges.provider';
import type { IGetChargesByIdsResult } from 'server/src/modules/charges/types';
import { commonModule } from 'server/src/modules/common';
import { DocumentsProvider } from 'server/src/modules/documents/providers/documents.provider';
import type { IGetAllDocumentsResult } from 'server/src/modules/documents/types';
import { financialEntitiesModule } from 'server/src/modules/financial-entities';
import { FinancialEntitiesProvider } from 'server/src/modules/financial-entities/providers/financial-entities.provider';
import { TaxCategoriesProvider } from 'server/src/modules/financial-entities/providers/tax-categories.provider';
import { businessesResolvers } from 'server/src/modules/financial-entities/resolvers/business-transactions.resolver';
import type {
  IGetFinancialEntitiesByIdsResult,
  IGetTaxCategoryByBusinessAndOwnerIDsResult,
} from 'server/src/modules/financial-entities/types';
import { ledgerModule } from 'server/src/modules/ledger';
import { ExchangeProvider } from 'server/src/modules/ledger/providers/exchange.provider';
import type { IGetExchangeRatesByDateResult } from 'server/src/modules/ledger/types';
import { tagsModule } from 'server/src/modules/tags';
import { TransactionsProvider } from 'server/src/modules/transactions/providers/transactions.provider';
import type { IGetTransactionsByIdsResult } from 'server/src/modules/transactions/types';
import { expect, test } from 'vitest';

let app: Application;

const charges: Array<IGetChargesByIdsResult> = [
  {
    accountant_reviewed: false,
    documents_event_amount: null,
    documents_max_date: null,
    documents_min_date: null,
    documents_vat_amount: null,
    event_amount: null,
    id: '1',
    invoices_count: null,
    is_conversion: false,
    is_property: false,
    owner_id: '1',
    receipts_count: null,
    transactions_event_amount: null,
    transactions_max_debit_date: null,
    transactions_max_event_date: null,
    transactions_min_debit_date: null,
    transactions_min_event_date: null,
    user_description: null,
  },
];

const documents: Array<IGetAllDocumentsResult> = [
  {
    charge_id: '1',
    charge_id_new: null,
    created_at: new Date(),
    creditor: null,
    creditor_id: '1',
    currency_code: 'USD',
    date: new Date('2020-10-15'),
    debtor: null,
    debtor_id: '2',
    description: null,
    file_url: null,
    id: '1',
    image_url: null,
    is_reviewed: false,
    modified_at: new Date(),
    serial_number: null,
    total_amount: 58_500,
    type: 'INVOICE',
    vat_amount: 8500,
  },
];

const taxCategories: Array<IGetTaxCategoryByBusinessAndOwnerIDsResult> = [
  {
    business_id: '2',
    id: '1',
    name: 'Tax Category 1',
    owner_id: '1',
  },
];

const exchangeRates: Array<IGetExchangeRatesByDateResult> = [
  {
    exchange_date: new Date('2020-10-15'),
    usd: '3.394',
    eur: '3.9774',
    gbp: null,
  },
];

const transactions: Array<IGetTransactionsByIdsResult> = [
  {
    account_id: '1',
    amount: '198316',
    business_id: '2',
    charge_id: '1',
    currency: 'ILS',
    current_balance: '198315',
    debit_date: new Date('2020-10-19'),
    event_date: new Date('2020-10-19'),
    id: '1',
    source_description: 'Description for transaction 1',
    source_id: '1',
  },
];

const businesses: Array<IGetFinancialEntitiesByIdsResult> = [
  {
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
    id: '1',
    name: 'Owner',
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
  },
  {
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
    id: '2',
    name: 'Business 2',
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
  },
];

beforeAll(async () => {
  app = testkit.testModule(ledgerModule, {
    inheritTypeDefs: [commonModule, chargesModule, financialEntitiesModule, tagsModule],
    typeDefs: gql`
      type Query {
        charge(id: ID): Charge
      }
    `,
    resolvers: {
      Query: {
        charge(_: unknown, { id }: { id: string }) {
          return charges.find(c => c.id === id);
        },
      },
      NamedCounterparty: businessesResolvers.NamedCounterparty,
    },
    providers: [
      {
        provide: ChargesProvider,
        useValue: {
          getChargeByIdLoader: {
            load: (chargeId: string) => {
              return charges.find(c => c.id === chargeId);
            },
          },
        },
      },
      {
        provide: DocumentsProvider,
        useValue: {
          getDocumentsByChargeIdLoader: {
            load: (chargeId: string) => {
              return documents.filter(d => d.charge_id === chargeId);
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
              return transactions.filter(t => t.charge_id === chargeId);
            },
          },
        },
      },
      {
        provide: FinancialEntitiesProvider,
        useValue: {
          getFinancialEntityByIdLoader: {
            load: async (id: string) => {
              const business = businesses.find(b => b.id === id);
              return business;
            },
          },
        },
      },
    ],
    replaceExtensions: true,
  });
});

test('should generate ledger records correctly', async () => {
  const result = await testkit.execute(app, {
    document: gql`
      query Test($id: ID!) {
        charge(id: $id) {
          ledgerRecords {
            ... on LedgerRecords {
              records {
                creditAccount1 {
                  ... on NamedCounterparty {
                    name
                  }
                  ... on TaxCategory {
                    name
                  }
                }
                creditAccount2 {
                  ... on NamedCounterparty {
                    name
                  }
                  ... on TaxCategory {
                    name
                  }
                }
                creditAmount1 {
                  formatted
                }
                creditAmount2 {
                  formatted
                }
                debitAccount1 {
                  ... on NamedCounterparty {
                    name
                  }
                  ... on TaxCategory {
                    name
                  }
                }
                debitAccount2 {
                  ... on NamedCounterparty {
                    name
                  }
                  ... on TaxCategory {
                    name
                  }
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
    `,
    variableValues: {
      id: '1',
    },
  });

  expect(result.data?.charge?.ledgerRecords).toBeDefined();

  expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();

  expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
});
