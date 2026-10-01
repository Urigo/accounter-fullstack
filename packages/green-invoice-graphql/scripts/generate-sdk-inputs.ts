/**
 * Turns the composed supergraph into the two inputs the typed SDK needs:
 *
 * - `supergraph.ts` — the SDL as a module, so the runtime imports it and nothing has to be copied
 *   into `dist`.
 * - `operations.graphql` — one operation per root field. GraphQL Mesh v1 no longer generates these
 *   (v0's `sdk.generateOperations`), so this reproduces that behavior: same algorithm, same depth and
 *   the same `<field>_query` / `<field>_mutation` names, which keeps the generated SDK method and type
 *   names stable.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSchema, print } from 'graphql';
import { buildOperationNodeForField, getRootTypeMap } from '@graphql-tools/utils';

const SELECTION_SET_DEPTH = 5;

const generatedDir = new URL('../src/__generated__/', import.meta.url);
const supergraph = readFileSync(new URL('supergraph.graphql', generatedDir), 'utf8');

writeFileSync(
  new URL('supergraph.ts', generatedDir),
  `export default ${JSON.stringify(supergraph)};\n`,
);

const schema = buildSchema(supergraph, { assumeValidSDL: true });
const operations = [...getRootTypeMap(schema)].flatMap(([kind, rootType]) =>
  Object.keys(rootType.getFields()).map(field =>
    print(buildOperationNodeForField({ schema, kind, field, depthLimit: SELECTION_SET_DEPTH })),
  ),
);
writeFileSync(new URL('operations.graphql', generatedDir), operations.join('\n\n') + '\n');
