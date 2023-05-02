/* eslint-disable @typescript-eslint/no-var-requires */
const { resolve } = require('node:path');
const { pathsToModuleNameMapper } = require('ts-jest');

const CI = !!process.env.CI;

const ROOT_DIR = __dirname;
const TSCONFIG = resolve(ROOT_DIR, 'tsconfig.json');
const tsconfig = require(TSCONFIG);

process.env.LC_ALL = 'en_US';

const testMatch = [
  '<rootDir>/client/**/?(*.)+(spec|test).[jt]s?(x)',
  '<rootDir>/server/**/?(*.)+(spec|test).[jt]s?(x)',
];

testMatch.push('!**/dist/**', '!**/.bob/**');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  transformIgnorePatterns: ['node_modules', 'dist'],
  rootDir: ROOT_DIR,
  restoreMocks: true,
  reporters: ['default'],
  modulePathIgnorePatterns: ['dist'],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: `${ROOT_DIR}/`,
    useESM: true,
  }),

  useESM: true,
  collectCoverage: false,
  cacheDirectory: resolve(ROOT_DIR, `${CI ? '' : 'node_modules/'}.cache/jest`),
  testMatch,
  resolver: 'bob-the-bundler/jest-resolver',
  // extensionsToTreatAsEsm: ['.ts'],
};
