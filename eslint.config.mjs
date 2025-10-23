import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gitignore from 'eslint-config-flat-gitignore';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import graphqlPlugin from '@graphql-eslint/eslint-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// override @theguild's unicorn version with local
function replaceUnicornRules(set) {
  return set?.plugins?.unicorn
    ? { ...set, plugins: { ...set.plugins, unicorn: eslintPluginUnicorn } }
    : set;
}

// Disable projectService for all configs to prevent type-aware linting memory issues
function disableTypeAwareLinting(config) {
  return {
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        projectService: false,
        project: null,
      },
    },
  };
}

export default [
  gitignore(),
  {
    ignores: [
      'packages/old-accounter/**/*',
      '**/__generated__/**/*',
      '**/schema.graphql',
      '**/__tests__/**/*',
      '**/.*rc.*js',
      '**/.bob/',
      '**/tsup.config.ts',
      '.pnp.*',
      '.yarn/*',
      '**/*.pdf',
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/*.d.ts', // Exclude type definition files
    ],
  },
  // Apply @theguild config BUT disable type-aware linting
  ...compat.extends('@theguild').map(replaceUnicornRules).map(disableTypeAwareLinting),
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },

    rules: {
      'no-console': 1,
      // Disable type-aware rules that require projectService
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-arguments': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/prefer-includes': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/prefer-reduce-type-parameter': 'off',
      '@typescript-eslint/prefer-return-this-type': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'off',
      '@typescript-eslint/promise-function-async': 'off',
      '@typescript-eslint/require-array-sort-compare': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'off',
    },
  },
  {
    files: ['**/*.{graphql,gql}'],

    plugins: {
      '@graphql-eslint': graphqlPlugin,
    },

    languageOptions: {
      parser: graphqlPlugin.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    // Only process files that actually contain GraphQL operations/fragments
    files: [
      'packages/client/src/**/*.{,c,m}{j,t}s{,x}',
      'packages/server/src/modules/*/typeDefs/*.graphql.ts',
    ],

    processor: graphqlPlugin.processor,
  },
  {
    // Setup recommended config for schema files (GraphQL type definitions)
    files: ['packages/server/src/modules/*/typeDefs/**/*.{graphql,gql}'],
    rules: graphqlPlugin.configs['flat/schema-recommended'].rules,
  },
  {
    files: ['packages/server/src/modules/*/typeDefs/**/*.{graphql,gql}'],

    rules: {
      '@graphql-eslint/description-style': [
        'error',
        {
          style: 'inline',
        },
      ],

      '@graphql-eslint/strict-id-in-types': [
        'error',
        {
          acceptedIdTypes: ['ID', 'UUID'],

          exceptions: {
            types: [
              'AccountantApproval',
              'BatchUpdateChargesSuccessfulResult',
              'BusinessTripSummary',
              'BusinessTripSummaryRow',
              'ChargeMetadata',
              'ChargeSuggestions',
              'ChargesWithLedgerChangesResult',
              'CommonError',
              'ConversionRate',
              'DateRange',
              'GreenInvoiceDiscount',
              'DocumentSuggestions',
              'DynamicReportNodeData',
              'ExchangeRates',
              'FinancialAmount',
              'FinancialIntAmount',
              'FlagForeignFeeTransactionsResult',
              'GeneratedLedgerRecords',
              'GreenInvoiceIncome',
              'GreenInvoicePayment',
              'IncomeExpenseChart',
              'IncomeExpenseChartMonthData',
              'Ledger',
              'LedgerBalanceInfo',
              'LedgerBalanceUnbalancedEntity',
              'LedgerValidation',
              'MergeChargeSuccessfulResult',
              'MergeChargesByTransactionReferenceResult',
              'NewDocumentInfo',
              'PageInfo',
              'PaginatedCharges',
              'PaginatedBusinesses',
              'PaginatedFinancialEntities',
              'PCNFileResult',
              'PCNRawData',
              'Shaam6111Header',
              'Shaam6111ReportEntry',
              'SicknessDays',
              'Suggestions',
              'SuggestionsEmailListenerConfig',
              'ReportCommentary',
              'ReportCommentaryRecord',
              'ReportCommentarySubRecord',
              'TransactionSuggestions',
              'UncategorizedTransaction',
              'UniformFormat',
              'UpdateChargeSuccessfulResult',
              'UpdatedTransactionsSuccessfulResult',
              'UserContext',
              'VatReportResult',
              'VatReportRecord',
              'VacationDays',
              'ValidationData',
              'YearlyLedgerReportFinancialEntityInfo',
              'YearOfRelevance',
            ],
          },
        },
      ],
    },
  },
  {
    // Setup recommended config for operations files (queries, mutations, subscriptions)
    files: ['packages/client/src/**/*.{graphql,gql}'],
    rules: graphqlPlugin.configs['flat/operations-recommended'].rules,
  },
  {
    files: ['packages/client/src/**/*.{graphql,gql}'],

    rules: {
      '@graphql-eslint/unique-operation-name': 'error',
      '@graphql-eslint/unique-fragment-name': 'error',

      '@graphql-eslint/known-directives': [
        'warn',
        {
          ignoreClientDirectives: ['@defer', '@stream'],
        },
      ],
    },
  },
  ...compat.extends('@theguild/eslint-config/react').map(config => {
    return {
      ...disableTypeAwareLinting(replaceUnicornRules(config)),
      files: ['packages/client/src/**/*.{,c,m}{j,t}s{,x}'],
    };
  }),
  {
    files: ['packages/client/src/**/*.{,c,m}{j,t}s{,x}'],

    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['server/**'],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['packages/migrations/**'],
    rules: {
      'unicorn/filename-case': 0,
      'promise/no-nesting': 1,
    },
  },
];
