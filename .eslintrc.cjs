const SCHEMA_PATH = 'schema.graphql';
const OPERATIONS_PATH = 'client/**/*.{,c,m}{j,t}s{,x}';

module.exports = {
  extends: ['@theguild'],
  rules: {
    'no-console': 1,
    '@typescript-eslint/no-unused-expressions': 'off', // TODO @dima!
  },
  overrides: [
    {
      // Setup GraphQL Parser
      files: '**/*.{graphql,gql}',
      parser: '@graphql-eslint/eslint-plugin',
      plugins: ['@graphql-eslint'],
      parserOptions: {
        schema: SCHEMA_PATH,
        operations: OPERATIONS_PATH,
      },
    },
    {
      // Setup processor for code-files
      files: OPERATIONS_PATH,
      processor: '@graphql-eslint/graphql',
    },
    {
      // Setup recommended config for schema file
      files: SCHEMA_PATH,
      extends: 'plugin:@graphql-eslint/schema-recommended',
      rules: {
        '@graphql-eslint/description-style': ['error', { style: 'inline' }],
        '@graphql-eslint/strict-id-in-types': [
          'error',
          {
            exceptions: {
              types: [
                'AccountantApproval',
                'BeneficiaryCounterparty',
                'CommonError',
                'DateRange',
                'FinancialAmount',
                'FinancialIntAmount',
                'NamedCounterparty',
                'PageInfo',
                'PaginatedCharges',
                'SortCode',
                'VatReportResult',
                'VatReportRecord',
                'ValidationData',
                'PCNFileResult',
                'PCNRawData',
              ],
            },
          },
        ],
      },
    },
    {
      // Setup recommended config for operations files
      files: 'client/**/*.{graphql,gql}',
      extends: 'plugin:@graphql-eslint/operations-recommended',
      rules: {
        '@graphql-eslint/unique-operation-name': 'error',
        '@graphql-eslint/unique-fragment-name': 'error',
      },
    },
    {
      files: 'client/**',
      extends: '@theguild/eslint-config/react',
      env: {
        browser: true,
      },
      rules: {
        'import/extensions': 'off', // TODO @dima!
        'react/hook-use-state': 'off', // TODO @dima!
      },
    },
    {
      files: 'server/**',
      env: {
        node: true,
      },
    },
  ],
  ignorePatterns: ['old-accounter/**', 'temp-server/**'],
};
