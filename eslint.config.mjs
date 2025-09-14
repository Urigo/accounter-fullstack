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

export default [
  gitignore(),
  {
    ignores: [
      'packages/old-accounter/**/*',
      '**/__generated__/**/*',
      '**/schema.graphql',
      '**/__tests__/**/*',
      '**/.eslintrc.cjs',
      '**/.*rc.*js',
      '**/.bob/',
      '**/tsup.config.ts',
      '.pnp.*',
      '.yarn/*',
    ],
  },
  ...compat.extends('@theguild').map(replaceUnicornRules),
  {
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',

      parserOptions: {
        project: ['tsconfig.json', '*/tsconfig.json'],
      },
    },

    rules: {
      'no-console': 1,
    },
  },
  {
    files: ['**/*.{graphql,gql}'],

    plugins: {
      '@graphql-eslint': graphqlPlugin,
    },

    languageOptions: {
      parser: graphqlPlugin.parser,
      ecmaVersion: 5,
      sourceType: 'script',
    },
  },
  {
    files: [
      'packages/client/src/**/*.{,c,m}{j,t}s{,x}',
      'packages/server/src/modules/*/typeDefs/*.graphql.ts',
    ],

    processor: graphqlPlugin.processor,
  },
  //   ...compat.extends('plugin:@graphql-eslint/schema-recommended').map(config => ({
  //     ...config,
  //     files: ['packages/server/src/modules/*/typeDefs/**/*.{graphql,gql}'],
  //   })),
  {
    // Setup recommended config for schema files
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
              'ReportCommentary',
              'ReportCommentaryRecord',
              'ReportCommentarySubRecord',
              'TransactionSuggestions',
              'UncategorizedTransaction',
              'UniformFormat',
              'UpdateChargeSuccessfulResult',
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
  //   ...compat.extends('plugin:@graphql-eslint/operations-recommended').map(config => ({
  //     ...config,
  //     files: ['packages/client/src/**/**/*.{graphql,gql}'],
  //   })),
  {
    // Setup recommended config for operations files
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
      ...replaceUnicornRules(config),
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
