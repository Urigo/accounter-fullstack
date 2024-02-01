import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './packages/server/src/modules/*/typeDefs/*.graphql.ts',
  documents: [
    './packages/client/src/components/**/*.tsx',
    './packages/client/src/hooks/**/*.ts',
    './packages/client/**/*.graphql.ts',
  ],
  config: {
    scalars: {
      TimelessDate: 'TimelessDateString',
      IBAN: 'string',
      URL: 'URL | string',
      FileScalar: 'File | Blob',
    },
  },
  generates: {
    'schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
        commentDescriptions: false,
      },
    },
    'packages/server/src/modules/': {
      preset: 'graphql-modules',
      presetConfig: {
        baseTypesPath: '../__generated__/types.ts',
        filename: '__generated__/types.ts',
        encapsulateModuleTypes: 'namespace',
      },
      config: {
        immutableTypes: true,
        contextType: 'GraphQLModules.Context',
        optionalResolveType: true,
        enumValues: {
          ChargeSortByField: '@shared/enums#ChargeSortByField',
          Currency: '@shared/enums#Currency',
          DocumentType: '@shared/enums#DocumentType',
          MissingChargeInfo: '@shared/enums#MissingChargeInfo',
          TransactionDirection: '@shared/enums#TransactionDirection',
        },
        mappers: {
          BankFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByFinancialEntityIdsResult',
          Business: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          BusinessTransaction: '@shared/types#BusinessTransactionProto',
          BusinessTransactionSum: '@shared/types#RawBusinessTransactionsSum',
          BusinessTrip: '@modules/business-trips/types.js#IGetAllBusinessTripsResult',
          BusinessTripCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          CardFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByFinancialEntityIdsResult',
          CommonCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          CommonTransaction: '@modules/transactions/types.js#IGetTransactionsByIdsResult',
          ConversionCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          ConversionTransaction: '@modules/transactions/types.js#IGetTransactionsByIdsResult',
          CreditInvoice: '@modules/documents/types.js#IGetAllDocumentsResult',
          CryptoWalletFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByFinancialEntityIdsResult',
          DividendCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          DocumentSuggestions: '@shared/types#DocumentSuggestionsProto',
          ExchangeRates: 'TimelessDateString',
          FeeTransaction: '@modules/transactions/types.js#IGetTransactionsByIdsResult',
          FinancialEntity: '@modules/financial-entities/types.js#IGetFinancialEntitiesByIdsResult',
          InternalTransferCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          Invoice: '@modules/documents/types.js#IGetAllDocumentsResult',
          InvoiceReceipt: '@modules/documents/types.js#IGetAllDocumentsResult',
          LedgerRecord: '@modules/ledger/types.js#IGetLedgerRecordsByChargesIdsResult',
          Ledger: '@shared/types#LedgerRecordsProto',
          LtdFinancialEntity: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          MonthlyVatCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          PersonalFinancialEntity: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          Proforma: '@modules/documents/types.js#IGetAllDocumentsResult',
          Receipt: '@modules/documents/types.js#IGetAllDocumentsResult',
          Salary: '@modules/salaries/types.js#IGetAllSalaryRecordsResult',
          SalaryCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          SortCode: '@modules/sort-codes/types.js#IGetSortCodesByIdsResult',
          TaxCategory: '@modules/financial-entities/types.js#IGetAllTaxCategoriesResult',
          Unprocessed: '@modules/documents/types.js#IGetAllDocumentsResult',
          VatReportRecord: '@modules/reports/helpers/vat-report.helper.js#RawVatReportRecord',
          WireTransaction: '@modules/transactions/types.js#IGetTransactionsByIdsResult',
          BusinessTripUncategorizedTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsTransactionsResult',
          BusinessTripAccommodationTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsAccommodationsTransactionsResult',
          BusinessTripFlightTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsFlightsTransactionsResult',
          BusinessTripTravelAndSubsistenceTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsTravelAndSubsistenceTransactionsResult',
          BusinessTripOtherTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsOtherTransactionsResult',
          LedgerBalanceUnbalancedEntity: '@shared/types#LedgerBalanceUnbalancedEntityProto',
        },
      },
      plugins: [
        'typescript',
        'typescript-resolvers',
        {
          add: {
            content: "import { TimelessDateString } from '@shared/types'",
          },
        },
      ],
    },
    'packages/client/src/gql/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: {
          unmaskFunctionName: 'getFragmentData',
        },
      },
      plugins: [
        {
          add: {
            content: "import { TimelessDateString } from '../helpers'",
          },
        },
      ],
    },
  },
};

// eslint-disable-next-line import/no-default-export
export default config;
