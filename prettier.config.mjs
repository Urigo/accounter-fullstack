import prettierConfig from '@theguild/prettier-config';

/**
 * @type {import('prettier').Config}
 */

const config = {
  ...prettierConfig,
  importOrderParserPlugins: ['importAssertions', ...prettierConfig.importOrderParserPlugins],
  plugins: [...prettierConfig.plugins, 'prettier-plugin-sql'],
  // prettier-plugin-sql options
  language: 'postgresql',
  keywordCase: 'upper',
  // Disable import sorting for markdown files to avoid parsing errors on TypeScript code blocks
  overrides: [
    {
      files: '*.md',
      options: {
        plugins: prettierConfig.plugins.filter(
          plugin => plugin !== '@ianvs/prettier-plugin-sort-imports',
        ),
      },
    },
  ],
};

// eslint-disable-next-line import/no-default-export
export default config;
