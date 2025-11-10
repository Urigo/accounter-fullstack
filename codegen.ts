import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './packages/server/src/modules/*/typeDefs/*.graphql.ts',
  documents: [
    './packages/client/src/components/**/*.tsx',
    './packages/client/src/hooks/**/*.ts',
    './packages/client/src/providers/**/*.tsx',
    './packages/client/**/*.graphql.ts',
  ],
  emitLegacyCommonJSImports: false,
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
          URL: 'URL | string',
          DateTime: {
            input: 'Date',
            output: 'Date',
          },
          BigInt: {
            input: 'bigint',
            output: 'bigint',
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
          AdminBusiness: '@modules/financial-entities/types.js#IGetAllAdminBusinessesResult',
          AdminContext: '@modules/admin-context/types.js#IGetAdminContextsResult',
          BalanceTransactions: '@modules/reports/types.js#IGetNormalizedBalanceTransactionsResult',
          BankDepositCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          BankFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByOwnerIdsResult',
          BankDepositFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByOwnerIdsResult',
          Business: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          BusinessTransaction: '@shared/types#BusinessTransactionProto',
          BusinessTransactionSum: '@shared/types#RawBusinessTransactionsSum',
          BusinessTrip: '@modules/business-trips/types.js#BusinessTripProto',
          BusinessTripAccommodationExpense:
            '@modules/business-trips/types.js#IGetBusinessTripsAccommodationsExpensesByIdsResult',
          BusinessTripAttendee:
            '@modules/business-trips/types.js#IGetBusinessTripsAttendeesByBusinessTripIdsResult',
          BusinessTripCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          BusinessTripFlightExpense:
            '@modules/business-trips/types.js#IGetBusinessTripsFlightsExpensesByIdsResult',
          BusinessTripOtherExpense:
            '@modules/business-trips/types.js#IGetBusinessTripsOtherExpensesByIdsResult',
          BusinessTripTravelAndSubsistenceExpense:
            '@modules/business-trips/types.js#IGetBusinessTripsTravelAndSubsistenceExpensesByIdsResult',
          BusinessTripCarRentalExpense:
            '@modules/business-trips/types.js#IGetBusinessTripsCarRentalExpensesByIdsResult',
          CardFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByOwnerIdsResult',
          ChargeMatch: '@modules/charges-matcher/types.js#ChargeMatchProto',
          ChargeMetadata: '@modules/charges/types.js#IGetChargesByIdsResult',
          Client: '@modules/financial-entities/types.js#IGetAllClientsResult',
          ClientIntegrations: '@modules/financial-entities/types.js#IGetAllClientsResult',
          CommonCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          CommonTransaction: 'string',
          ConversionCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          ConversionTransaction: 'string',
          CorporateTax: '@modules/corporate-taxes/types.js#IGetCorporateTaxesByCorporateIdsResult',
          CorporateTaxRulingComplianceReport:
            '@shared/types#CorporateTaxRulingComplianceReportProto',
          Contract: '@modules/contracts/types.js#IGetAllOpenContractsResult',
          Country: '@modules/countries/types.js#IGetAllCountriesResult',
          CreditcardBankCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          CreditInvoice: '@modules/documents/types.js#IGetAllDocumentsResult',
          CryptoWalletFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByOwnerIdsResult',
          DepreciationCategory:
            '@modules/depreciation/types.js#IGetAllDepreciationCategoriesResult',
          DepreciationRecord: '@modules/depreciation/types.js#IGetDepreciationRecordsByIdsResult',
          DividendCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          DocumentSuggestions: '@shared/types#DocumentSuggestionsProto',
          DynamicReportInfo: '@modules/reports/types.js#IGetTemplateResult',
          ExchangeRates: 'TimelessDateString',
          FinancialEntity: '@modules/financial-entities/types.js#IGetFinancialEntitiesByIdsResult',
          ForeignSecuritiesCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          ForeignSecuritiesFinancialAccount:
            '@modules/financial-accounts/types.js#IGetFinancialAccountsByOwnerIdsResult',
          GreenInvoiceClient: 'string',
          IncomeExpenseChartMonthData: '@modules/charts/types.js#MonthDataProto',
          InternalTransferCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          Invoice: '@modules/documents/types.js#IGetAllDocumentsResult',
          InvoiceReceipt: '@modules/documents/types.js#IGetAllDocumentsResult',
          IssuedDocumentInfo: '@modules/documents/types.js#IssuedDocumentInfoProto',
          LedgerBalanceUnbalancedEntity: '@shared/types#LedgerBalanceUnbalancedEntityProto',
          LedgerRecord: '@modules/ledger/types.js#IGetLedgerRecordsByChargesIdsResult',
          Ledger: '@shared/types#LedgerRecordsProto',
          LtdFinancialEntity: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          MiscExpense: '@modules/misc-expenses/types.js#IGetExpensesByChargeIdsResult',
          MonthlyVatCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          OtherDocument: '@modules/documents/types.js#IGetAllDocumentsResult',
          PersonalFinancialEntity: '@modules/financial-entities/types.js#IGetBusinessesByIdsResult',
          ProfitAndLossReportYear: '@modules/reports/types.js#ProfitAndLossReportYearProto',
          Proforma: '@modules/documents/types.js#IGetAllDocumentsResult',
          Receipt: '@modules/documents/types.js#IGetAllDocumentsResult',
          ReportCommentaryRecord: '@modules/reports/types.js#CommentaryRecordProto',
          ReportCommentarySubRecord: '@modules/reports/types.js#CommentarySubRecordProto',
          FinancialCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          Salary: '@modules/salaries/types.js#IGetAllSalaryRecordsResult',
          SalaryCharge: '@modules/charges/types.js#IGetChargesByIdsResult',
          Shaam6111Report: '@modules/reports/types.js#Shaam6111ReportProto',
          SortCode: '@modules/sort-codes/types.js#IGetSortCodesByIdsResult',
          Tag: '@modules/tags/types.js#IGetAllTagsResult',
          TaxCategory: '@modules/financial-entities/types.js#IGetAllTaxCategoriesResult',
          TaxReportYear: '@modules/reports/types.js#TaxReportYearProto',
          Unprocessed: '@modules/documents/types.js#IGetAllDocumentsResult',
          VatReportRecord: '@modules/reports/helpers/vat-report.helper.js#RawVatReportRecord',
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
        enumsAsConst: true,
        useTypeImports: true,
        scalars: {
          TimelessDate: '../helpers/index.js#TimelessDateString',
          FileScalar: {
            input: 'File | Blob',
            output: 'string',
          },
          UUID: {
            input: 'string',
            output: 'string',
          },
          URL: 'URL | string',
          DateTime: {
            input: 'Date',
            output: 'Date',
          },
          BigInt: {
            input: 'bigint',
            output: 'bigint',
          },
        },
      },
    },
  },
};

export default config;
