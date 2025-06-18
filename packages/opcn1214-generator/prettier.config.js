import rootConfig from "../../prettier.config.mjs";

/** @type {import("prettier").Config} */
const config = {
  ...rootConfig,
  semi: false,
  singleQuote: true,
  trailingComma: "es5",
  printWidth: 100,
};

export default config;
