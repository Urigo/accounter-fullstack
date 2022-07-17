const SCHEMA_PATH = 'schema.graphql';
const OPERATIONS_PATH = 'client/**/*.{,c,m}{j,t}s{,x}';

module.exports = {
  extends: ['@theguild'],
  plugins: ['eslint-plugin-simple-import-sort'],
  rules: {
    'no-console': 1,
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
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
      extends: ['plugin:@graphql-eslint/schema-recommended', '@theguild/eslint-config/react'],
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
                'NamedCounterparty',
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
      env: {
        browser: true,
      },
    },
    {
      files: 'server/**',
      env: {
        node: true,
      },
    },
    {
      files: 'client/**/*.tsx',
      rules: {
        'react/jsx-no-useless-fragment': 'error',
      },
    },
  ],
  ignorePatterns: ['**/old-accounter/**', '**/temp-server/**'],
};
