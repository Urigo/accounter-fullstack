const { plugins, ...prettierConfig } = require('@theguild/prettier-config');

module.exports = {
  ...prettierConfig,
  plugins: [...plugins, 'prettier-plugin-sql'],
  // prettier-plugin-sql options
  language: 'postgresql',
  keywordCase: 'upper',
};
