const { dirname } = require('node:path');

const MODULES_PATH = 'server/src/modules/*/typeDefs/*.graphql.ts';
const OPERATIONS_PATH = 'client/**/*.{,c,m}{j,t}s{,x}';

module.exports = {
  extends: ['@theguild'],
  rules: {
    'no-console': 1,
  },
  overrides: [
    {
      // Setup GraphQL Parser
      files: '**/*.{graphql,gql}',
      parser: '@graphql-eslint/eslint-plugin',
      plugins: ['@graphql-eslint'],
      parserOptions: {
        schema: MODULES_PATH,
        documents: OPERATIONS_PATH,
      },
    },
    {
      // Setup processor for code-files
      files: [OPERATIONS_PATH, MODULES_PATH],
      processor: '@graphql-eslint/graphql',
    },
    {
      // Setup recommended config for schema file
      files: `${dirname(MODULES_PATH)}/**/*.{graphql,gql}`,
      extends: 'plugin:@graphql-eslint/schema-recommended',
      rules: {
        '@graphql-eslint/description-style': ['error', { style: 'inline' }],
        '@graphql-eslint/strict-id-in-types': [
          'error',
          {
            acceptedIdTypes: ['ID', 'UUID'],
            exceptions: {
              types: [
                'AccountantApproval',
                'BeneficiaryCounterparty',
                'ChargeMetadata',
                'ChargeSuggestions',
                'CommonError',
                'ConversionRate',
                'DateRange',
                'ExchangeRates',
                'FinancialAmount',
                'FinancialIntAmount',
                'GeneratedLedgerRecords',
                'LedgerRecords',
                'NamedCounterparty',
                'PageInfo',
                'PaginatedCharges',
                'PCNFileResult',
                'PCNRawData',
                'SortCode',
                'TransactionSuggestions',
                'VatReportResult',
                'VatReportRecord',
                'ValidationData',
                'DocumentSuggestions',
              ],
            },
          },
        ],
      },
    },
    {
      // Setup recommended config for operations files
      files: `${dirname(OPERATIONS_PATH)}/**/*.{graphql,gql}`,
      extends: 'plugin:@graphql-eslint/operations-recommended',
      rules: {
        '@graphql-eslint/unique-operation-name': 'error',
        '@graphql-eslint/unique-fragment-name': 'error',
      },
    },
    {
      files: OPERATIONS_PATH,
      extends: '@theguild/eslint-config/react',
      env: {
        browser: true,
      },
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'error',
      },
    },
    {
      files: 'server/**',
      env: {
        node: true,
      },
    },
  ],
  ignorePatterns: ['old-accounter/**', '**/__generated__/**', 'schema.graphql', '**/__tests__/**'],
};
