import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Generates the typed SDK from the composed supergraph and the operations derived from it.
 *
 * The settings mirror what `@graphql-mesh/cli` (Mesh v0) used internally, so the exported names that
 * `@accounter/server` depends on stay the same (e.g. `_DOLLAR_defs_Document`, `getDocument_query`,
 * enums as `'_305'` string literals).
 */
const sharedConfig = {
  namingConvention: 'keep',
  enumsAsTypes: true,
  ignoreEnumValuesFromSchema: false,
  useTypeImports: true,
  scalars: {
    JSON: 'any',
    ObjMap: 'any',
    EmailAddress: 'string',
    UUID: 'string',
    NonEmptyString: 'string',
    Date: '`\x24{number}-\x24{number}-\x24{number}`',
    NonNegativeFloat: 'number',
    NonNegativeInt: 'number',
    PositiveFloat: 'number',
    PositiveInt: 'number',
  },
};

const config: CodegenConfig = {
  schema: './src/__generated__/supergraph.graphql',
  generates: {
    // Schema types (objects, inputs, enums), consumed directly by `@accounter/server`.
    './src/__generated__/types.ts': {
      plugins: ['typescript'],
      config: {
        ...sharedConfig,
        skipTypename: true,
      },
    },
    // Since v6, `typescript-operations` emits the inputs and enums its operations use. Pointing it at
    // the shared types file keeps it from re-declaring them next to the `typescript` plugin output.
    './src/__generated__/sdk.ts': {
      documents: './src/__generated__/operations.graphql',
      plugins: ['typescript-operations', 'typescript-generic-sdk'],
      config: {
        ...sharedConfig,
        importSchemaTypesFrom: './src/__generated__/types.ts',
        importExtension: '.js',
        documentMode: 'documentNode',
      },
    },
  },
};

export default config;
