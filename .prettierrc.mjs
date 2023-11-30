import prettierPluginSql from 'prettier-plugin-sql';
import prettierConfig from '@theguild/prettier-config';

const config = {
  ...prettierConfig,
  plugins: [...prettierConfig.plugins, prettierPluginSql],
  // prettier-plugin-sql options
  language: 'postgresql',
  keywordCase: 'upper',
};

export default config;
