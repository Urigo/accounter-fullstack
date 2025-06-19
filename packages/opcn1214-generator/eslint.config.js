import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import vitestPlugin from "eslint-plugin-vitest";
import eslint from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import rootConfig from "../../eslint.config.mjs"; // Import the root config

export default [
  ...rootConfig, // Extend the root config
  {
    ignores: ["dist", "node_modules"],
  },
  {
    plugins: {
      import: importPlugin,
      vitest: vitestPlugin,
    },
    rules: {
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-unresolved": "off",
      "sort-imports": "off",
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      quotes: ["warn", "single", { avoidEscape: true }],
      semi: ["warn", "never"],
    },
    languageOptions: {
      globals: {
        browser: false,
        node: true,
        es6: true,
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": ts,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: true,
      },
    },
    extends: [ts.configs.recommended],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    plugins: {
      prettier: prettierConfig,
    },
    rules: {
      "prettier/prettier": "warn",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*"],
    plugins: {
      vitest: vitestPlugin,
    },
    extends: ["plugin:vitest/recommended"],
  },
];
