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
};

// eslint-disable-next-line import/no-default-export
export default config;
