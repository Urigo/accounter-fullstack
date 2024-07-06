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
      URL: 'URL | string',
      FileScalar: {
        input: 'File | Blob',
        output: 'string',
      },
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
        scalars: {
          TimelessDate: '@shared/types#TimelessDateString',
          FileScalar: {
            input: 'File | Blob',
            output: 'string',
          },
          UUID: {
            input: 'string',
            output: 'string',
          },
        },
        enumValues: {
          ChargeSortByField: '@shared/enums#ChargeSortByField',
          Currency: '@shared/enums#Currency',
          DocumentType: '@shared/enums#DocumentType',
          MissingChargeInfo: '@shared/enums#MissingChargeInfo',
          TransactionDirection: '@shared/enums#TransactionDirection',
        },
        mappers: {
          BankDepositCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          BankFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByOwnerIdsResult',
          Business: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          BusinessTransaction: '@shared/types#BusinessTransactionProto',
          BusinessTransactionSum: '@shared/types#RawBusinessTransactionsSum',
          BusinessTrip: '@modules/business-trips/types.js#BusinessTripProto',
          BusinessTripAccommodationTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsAccommodationsTransactionsResult',
          BusinessTripAttendee:
            '@modules/business-trips/types.js#IGetBusinessTripsAttendeesByBusinessTripIdsResult',
          BusinessTripCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          BusinessTripFlightTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsFlightsTransactionsResult',
          BusinessTripOtherTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsOtherTransactionsResult',
          BusinessTripTravelAndSubsistenceTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsTravelAndSubsistenceTransactionsResult',
          BusinessTripUncategorizedTransaction:
            '@modules/business-trips/types.js#IGetAllBusinessTripsTransactionsResult',
          CardFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByOwnerIdsResult',
          ChargeMetadata: '@modules/charges/types.js#IGetChargesByIdsResult',
          CommonCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          CommonTransaction: '@modules/transactions/types.js#IGetTransactionsByIdsResult',
          ConversionCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          ConversionTransaction: '@modules/transactions/types.js#IGetTransactionsByIdsResult',
          CreditcardBankCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          CreditInvoice: '@modules/documents/types.js#IGetAllDocumentsResult',
          CryptoWalletFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByOwnerIdsResult',
          DividendCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          DocumentSuggestions: '@shared/types#DocumentSuggestionsProto',
          ExchangeRates: 'TimelessDateString',
          FeeTransaction: '@modules/transactions/types.js#IGetTransactionsByIdsResult',
          FinancialEntity: '@modules/financial-entities/types.js#IGetFinancialEntitiesByIdsResult',
          InternalTransferCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          Invoice: '@modules/documents/types.js#IGetAllDocumentsResult',
          InvoiceReceipt: '@modules/documents/types.js#IGetAllDocumentsResult',
          LedgerBalanceUnbalancedEntity: '@shared/types#LedgerBalanceUnbalancedEntityProto',
          LedgerRecord: '@modules/ledger/types.js#IGetLedgerRecordsByChargesIdsResult',
          Ledger: '@shared/types#LedgerRecordsProto',
          LtdFinancialEntity: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          MonthlyVatCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          PersonalFinancialEntity: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          Proforma: '@modules/documents/types.js#IGetAllDocumentsResult',
          Receipt: '@modules/documents/types.js#IGetAllDocumentsResult',
          RevaluationCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          Salary: '@modules/salaries/types.js#IGetAllSalaryRecordsResult',
          SalaryCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          SortCode: '@modules/sort-codes/types.js#IGetSortCodesByIdsResult',
          Tag: '@modules/tags/types.js#IGetAllTagsResult',
          TaxCategory: '@modules/financial-entities/types.js#IGetAllTaxCategoriesResult',
          Unprocessed: '@modules/documents/types.js#IGetAllDocumentsResult',
          VatReportRecord: '@modules/reports/helpers/vat-report.helper.js#RawVatReportRecord',
          WireTransaction: '@modules/transactions/types.js#IGetTransactionsByIdsResult',
        },
      },
      plugins: ['typescript', 'typescript-resolvers'],
    },
    'packages/client/src/gql/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: {
          unmaskFunctionName: 'getFragmentData',
        },
      },
      config: {
        scalars: {
          TimelessDate: '../helpers#TimelessDateString',
        },
      },
    },
  },
};

// eslint-disable-next-line import/no-default-export
export default config;
