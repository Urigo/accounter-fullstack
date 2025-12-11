import prettierConfig from '@theguild/prettier-config';

/**
 * @type {import('prettier').Config}
 *
 * Enhanced Prettier configuration for the Accounter monorepo.
 *
 * This configuration extends @theguild/prettier-config (v3.0.1) with:
 * - Stricter import ordering rules for better code organization
 * - PostgreSQL support via prettier-plugin-sql (v0.19.2)
 * - Special handling for markdown files to prevent TypeScript code block parsing errors
 *
 * Core settings inherited from @theguild/prettier-config:
 * - trailingComma: "all"
 * - printWidth: 100
 * - singleQuote: true
 * - arrowParens: "avoid"
 * - proseWrap: "always"
 *
 * Active Prettier plugins:
 * - @ianvs/prettier-plugin-sort-imports (v4.4.1): Intelligent import sorting with stricter rules
 * - prettier-plugin-pkg: JSON package file formatting
 * - prettier-plugin-sh: Shell script formatting
 * - prettier-plugin-sql (v0.19.2): PostgreSQL/SQL formatting
 */

const config = {
  ...prettierConfig,

  /**
   * Stricter import ordering for better code organization.
   * Overrides the default guild config import order.
   *
   * Order (most restrictive to most general):
   * 1. React and framework core imports
   * 2. Third-party regular packages (pg, express, etc.)
   * 3. Third-party scoped packages (@pgtyped, @mui, @graphql, etc.)
   * 4. Internal monorepo aliases (@accounter/*, @accounter-helper/*)
   * 5. Internal absolute imports (from tsconfig paths)
   * 6. Relative imports and local files
   * 7. Style and non-JS asset imports
   */
  importOrder: [
    // React and React-adjacent libraries
    '^react$',
    '^react-dom',
    '^next',
    // Third-party regular packages (pg, express, etc.)
    '^[a-zA-Z]',
    // Third-party scoped packages (@pgtyped, @mui, @graphql, etc.)
    // Excludes our internal monorepo packages via negative lookahead
    '^@(?!accounter|accounter-helper|/)',
    // Internal monorepo packages
    '^@(accounter|accounter-helper)/',
    // Internal absolute imports (from tsconfig paths)
    '^@/([^/]+)(/.*|$)',
    // Relative imports
    '^\\.',
    // Style and asset imports
    '^(?=.*\\.(css|scss|less|graphql|gql|sql)$)',
  ],

  /**
   * Parser plugins for @ianvs/prettier-plugin-sort-imports.
   * Merged with guild config defaults, ensuring importAssertions is included.
   * Guild config includes: typescript, jsx, decorators-legacy
   */
  importOrderParserPlugins: [
    ...new Set([...prettierConfig.importOrderParserPlugins, 'importAssertions']),
  ],

  /**
   * Add prettier-plugin-sql to the plugin list for PostgreSQL formatting.
   */
  plugins: [...prettierConfig.plugins, 'prettier-plugin-sql'],

  /**
   * PostgreSQL formatting options for prettier-plugin-sql.
   * - language: PostgreSQL dialect for SQL formatting
   * - keywordCase: Format SQL keywords to UPPERCASE for consistency
   */
  language: 'postgresql',
  keywordCase: 'upper',

  /**
   * File-type-specific overrides
   */
  overrides: [
    ...prettierConfig.overrides,
    {
      /**
       * Markdown files: Disable import sorting plugin
       * Reason: The import sorter can cause parsing errors when TypeScript code blocks
       * are present in markdown (e.g., code examples in documentation). Other plugins
       * (base formatting, shell script handling, etc.) remain active.
       */
      files: '*.md',
      options: {
        plugins: prettierConfig.plugins.filter(
          plugin => plugin !== '@ianvs/prettier-plugin-sort-imports',
        ),
      },
    },
  ],
};

export default config;
