import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Generates the typed SDK from the composed supergraph and the operations derived from it.
 *
 * The settings mirror what `@graphql-mesh/cli` (Mesh v0) used internally, and the plugin majors match
 * the ones it bundled, so the exported names and shapes that `@accounter/server` depends on stay the
 * same (e.g. `_DOLLAR_defs_Document`, `getDocument_query`, enums as `'_305'` string literals).
 */
const config: CodegenConfig = {
  schema: './src/__generated__/supergraph.graphql',
  documents: './src/__generated__/operations.graphql',
  generates: {
    './src/__generated__/sdk.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
      config: {
        namingConvention: 'keep',
        skipTypename: true,
        enumsAsTypes: true,
        ignoreEnumValuesFromSchema: false,
        documentMode: 'documentNode',
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
      },
    },
  },
};

export default config;
