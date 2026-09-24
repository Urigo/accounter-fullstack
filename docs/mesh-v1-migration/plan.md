# GraphQL Mesh v0 → v1 migration plan — accounter-fullstack

Prepared 2026-09-24 against `main` @ `b6474190`. Covers every `@graphql-mesh/*` usage in the repo
and draft PR [#529](https://github.com/Urigo/accounter-fullstack/pull/529) (branch
`mesh-v1-migration`).

## Summary

- **Start #529 over from `main`.** The old branch was one pre-GA config file that no longer matched
  the current config or JSON schema. Nothing in it was worth rebasing, so the branch has been reset
  onto `main` (§4).
- **The scope is smaller than it looks.** Only `green-invoice-graphql` has a consumer (`server`).
  `hashavshevet-mesh` and `payper-mesh` have no consumers and no functional changes since 2024.
  Retire them instead of porting them (Phase 1).
- **The real v1 change is the loss of the generated SDK, not the new config format.** v1 composes a
  supergraph file and stops there. The typed SDK now comes from GraphQL Codegen and runs in-process
  via `getSdkRequesterForUnifiedGraph`. This is the pattern documented on the v1
  [Local execution](https://the-guild.dev/graphql/mesh/v1/local-execution) page.
- **The spike shows a drop-in replacement for `server`:**
  - The composed schema matches v0's: 108/108 types. The only loss is one `@oneOf` hint on an input
    `server` never uses.
  - The SDK has the same 19 methods and the same names for all 18 types `server` imports.
  - Runtime behavior matches for headers, query strings, status-code unions and errors.
- **There is no deadline.** v0 is still released in lockstep with v1 (`@graphql-mesh/cli@0.103.2`,
  Sept 2026), and The Guild has said it will keep maintaining it. The gain is a supported path and a
  smaller dependency set: runtime Mesh dependencies drop from 8 packages to 2, plus 2 compose-time
  dev dependencies. It is not an emergency.

## 1. What changed in Mesh v1 (the parts that affect this repo)

| v0                                                            | v1                                                                                                                                           | Impact here                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `.meshrc.yaml` → `mesh build` → executable `.mesh/` artifacts | `mesh.config.ts` (`composeConfig`) → `mesh-compose` → supergraph SDL (not executable)                                                        | New config; artifacts and the rename script go away                               |
| Generated `getMeshSDK()` / `getBuiltMesh()` / `execute`       | You run Codegen yourself (`typescript-generic-sdk`) + `getSdkRequesterForUnifiedGraph` or `createGatewayRuntime(...).sdkRequester`           | The SDK layer has to be rebuilt (Phase 2)                                         |
| `sdk.generateOperations.selectionSetDepth`                    | "You own the `.graphql` operations"                                                                                                          | Recreated with a ~20-line script, for parity                                      |
| `@graphql-mesh/json-schema` handler                           | `loadJSONSchemaSubgraph` from `@omnigraph/json-schema`, the **same engine** (v0's handler wraps it; both are 0.112.4) with identical options | The config is a 1:1 port                                                          |
| `additionalTypeDefs` / `additionalResolvers` + in-context SDK | Type defs at compose time; resolvers at runtime; the in-context SDK still exists, with typings from `@graphql-mesh/incontext-sdk-codegen`    | Affects only the two packages being retired                                       |
| `resolversComposition`, `rename` transforms                   | Removed / replaced by `createRenameTransform`                                                                                                | Affects only the two packages being retired (both dependencies are unused anyway) |
| `mesh dev` / `mesh start`                                     | Hive Gateway (formerly Mesh Serve)                                                                                                           | Not used: there is no gateway server here                                         |

Lifecycle:

- v1 went GA on 2024-09-10
  ([blog](https://the-guild.dev/graphql/hive/blog/graphql-mesh-v1-hive-gateway-v1): "we will
  continue to maintain v0 for the foreseeable future").
- The v0 docs are labelled "superseded by v1".
- The [migration guide](https://the-guild.dev/graphql/mesh/v1/migration-from-v0) is still titled
  "Experimental – Beta".
- Hive Gateway v2 shipped in 2025-09.
- There is no sign of a Mesh v2.

Current versions (Sept 2026):

| Package                            | Version |
| ---------------------------------- | ------- |
| `@graphql-mesh/compose-cli`        | 1.8.2   |
| `@omnigraph/json-schema`           | 0.112.4 |
| `@graphql-mesh/fusion-runtime`     | 1.12.1  |
| `@graphql-mesh/transport-rest`     | 0.12.2  |
| `@graphql-mesh/migrate-config-cli` | 1.10.2  |

## 2. Current Mesh usage on `main`

| Package                       | Sources / ops | v0-only features                                                                                                                                      | Consumers | Last non-dependency change                                |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------- |
| `green-invoice-graphql` 0.8.6 | 2 / 19        | —                                                                                                                                                     | `server`  | active                                                    |
| `hashavshevet-mesh` 0.2.12    | 1 / 14        | `additionalTypeDefs` + `additionalResolvers` (in-context SDK with `key`/`argsFromKeys` batching); unused `transform-resolvers-composition` dependency | **none**  | 2024-07 (plus an env-var cleanup in 2026-03)              |
| `payper-mesh` 0.2.12          | 1 / 1         | `additionalTypeDefs` + `additionalResolvers`; unused `transform-rename` dependency                                                                    | **none**  | config untouched since 2024-04 (plus the env-var cleanup) |

All three packages:

- use `@graphql-mesh/cli@0.103.2` plus 8–9 runtime `@graphql-mesh/*` packages each;
- are built by the root `build:tools` script and published to npm on every release;
- have received only Renovate bumps since 2024.

### 2.1 `green-invoice-graphql` in detail

**Config features in use:**

- `operationHeaders` with `Bearer {context.authToken}`
- `{args.id}` path parameters and `argTypeMap`
- `responseByStatusCode` (3 operations)
- `queryStringOptions` (`jsonStringify`; `indices` + `arrayFormat: brackets`) and `queryParamArgMap`
- `codegen.ignoreEnumValuesFromSchema: false`
- `sdk.generateOperations.selectionSetDepth: 5`

**Build:** `generate` runs `mesh build --dir ./src`, then `scripts/mesh-artifacts-rename.mjs`. That
script renames `.mesh` → `mesh-artifacts` and patches paths inside the generated files. `bob` then
copies `json-schemas/` and `src/mesh-artifacts/**/*.graphql` into `dist`.

**Runtime:** `init(id, secret)` obtains an OAuth token, then calls `getMeshSDK({ authToken })`.
`server` calls it per tenant from `app-providers/green-invoice-client.ts`.

**Contract with `server`** (this is what the migration must preserve):

- **13 of the 19 SDK methods:** `getDocument`, `searchDocuments`, `previewDocument`,
  `getLinkedDocuments`, `getDocumentsDownloadLinks`, `addDocument`, `closeDocument`,
  `searchExpenseDrafts`, `getFileUploadUrl`, `getClient`, `addClient`, `updateClient`,
  `deleteClient` (each with a `_query`/`_mutation` suffix).
- **18 generated type names across 7 files**, e.g. `_DOLLAR_defs_Document`,
  `_DOLLAR_defs_getClientResponse`, `query_getDocument_payment_items_type`,
  `updateClient_mutationMutationVariables`.
- **Names produced by the JSON Schema engine itself:**
  - numeric enums become `'_305'`-style literals (91 occurrences in 2 files);
  - `$defs` becomes a `_DOLLAR_defs_` prefix;
  - `X-Amz-*` upload fields become `X_Amz_*`, which the server reverses by hand.

  v1 uses the same engine, so all of these are preserved. The spike verified this.

**Wiring touchpoints:**

- the package's `package.json` (`generate`, `bob.build.copy`)
- `scripts/mesh-artifacts-rename.mjs` and the root script `mesh:artifacts-rename`
- `.gitignore` (`**/.mesh`, `**/mesh-artifacts`)
- root `tsconfig.json` paths
- `packages/server/vitest.config.ts` alias
- `server:build:prod` and the `dev` watch list
- root `build:tools`
- `CLAUDE.md`

**CI:** `pr.yml` runs `yarn build`. That is the gate that runs Mesh generation and then type-checks
`server`. The server unit tests mock `green-invoice-client.js`, so they never need the SDK at
runtime.

### 2.2 `hashavshevet-mesh` and `payper-mesh`

Nothing in the monorepo imports these two packages:

- The server's "hashavshevet" hits are the `hashavshevet_name` tax-category DB field.
- "payper" appears only in landing-page copy.

npm reports about 90k downloads a month for _each_ of the three packages, almost identical numbers.
That looks like mirror traffic, not real adoption. External users can't be ruled out, but there is
no evidence of any.

## 3. Spike: what was verified

I used throwaway projects in the scratchpad. I built today's Green Invoice config with v0 as the
baseline, then with v1, and compared the results. Nothing was changed in the repo.

| Check                                                                                      | Result                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mesh-migrate-config` on today's `.meshrc.yaml`                                            | Converts all 19 operations and every option. It warns that SDK/codegen aren't migrated, adds an unneeded `gatewayConfig`, and keeps the `../json-schemas` paths                                                                                                                                            |
| `mesh-compose` on both sources                                                             | OK (~1.2 s)                                                                                                                                                                                                                                                                                                |
| Public schema, v0 vs v1                                                                    | **108/108 types, same names/fields/args/enum values.** The only differences are Mesh-internal directive definitions (plus one internal scalar) and a lost `@oneOf` on `mutationInput_updateExpense_input_paymentType_Input` (`updateExpense` is unused by `server`)                                        |
| In-process execution                                                                       | The token from the context lands in `Authorization`; `{args.id}` paths work; `jsonStringify` gives `data={"source":5}`; `brackets` gives `valueDate[from]=…`; numeric enums come back as `'_305'`; `X-Amz-Date` becomes `X_Amz_Date`. With one shared requester, each tenant's token goes to its own calls |
| Status codes                                                                               | A 404 on `searchExpenseDrafts` resolves to its union member (`'items' in …` checks still work). A 404 without a mapping throws `GraphQLError: Upstream HTTP Error: 404 …`. Errors are thrown the same way as in v0 (a single error is thrown directly; several become an `AggregateError`)                 |
| JSON schemas at runtime                                                                    | Not needed; they are only used at compose time                                                                                                                                                                                                                                                             |
| SDK via Codegen                                                                            | **19/19 methods with identical names and signatures; all 18 server-imported types present**                                                                                                                                                                                                                |
| Codegen with the same plugin majors v0 bundles (`typescript@5`, `typescript-operations@5`) | **54/55 types mutually assignable** (the one miss is the `@oneOf` input above). `server` should compile unchanged                                                                                                                                                                                          |
| Codegen v6 (the root's current major)                                                      | Works, with two costs. It needs a two-file layout, because `typescript-operations` v6 emits its own inputs and enums and would duplicate them. Its nullability is also stricter: result fields become required `T \| null`, and input list items allow `undefined`. Expect small type fixes in `server`    |

Gotchas found along the way:

- `fusion-runtime` loads transports with `import('@graphql-mesh/transport-${kind}')` but doesn't
  depend on `transport-rest`. Declare it as a dependency and pass it explicitly.
- The REST transport resolves fetch as
  `context.fetch || transportContext.fetch || @whatwg-node/fetch`. It doesn't read
  `globalThis.fetch` at call time, so tests must inject `fetch`. The context is the easiest place.
- If you pass a `transportContext`, you must also pass `log`.
- `mesh-compose -o` doesn't create the output directory.
- Build the requester **once per process**. Parsing the supergraph is v1's equivalent of v0's cached
  `getBuiltMesh()`.

## 4. Assessment of PR #529

The PR has 2 commits: 2024-03-28 and a bot changeset on 2024-04-18. It is 3,293 commits behind
`main` and has merge conflicts. It has no description and no review discussion (only a bot snapshot
comment).

| Change                                                             | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mesh.config.ts` (7 ops)                                           | **Superseded.** `main` now has 19 operations over 2 sources. The JSON schema moved from `definitions` (30) to `$defs` (94), so every ref in the file points at nothing. `../json-schemas` is wrong relative to compose's `cwd`. It also contains a leftover docs example on `addExpense`: `responseSample: 'https://www.reddit.com/r/AskReddit.json'`. `mesh-migrate-config` regenerates the file from today's YAML in seconds |
| `@graphql-mesh/compose-cli@0.2.5`, `@omnigraph/json-schema@0.99.6` | `compose-cli@0.2.5` was a pre-GA release (1.0.0 shipped 2024-09-10). Both are 2½ years old; the current versions are 1.8.2 / 0.112.4                                                                                                                                                                                                                                                                                           |
| v0 dependencies kept alongside                                     | The branch never switched the build (`generate` still runs `mesh build`) or the runtime (`getMeshSDK`)                                                                                                                                                                                                                                                                                                                         |
| root `tsconfig.json` `"ts-node": { "esm": true }`                  | Obsolete. The repo runs Node 26 and `mesh-compose` loads TS configs itself                                                                                                                                                                                                                                                                                                                                                     |
| changeset, `yarn.lock`                                             | Stale; regenerate                                                                                                                                                                                                                                                                                                                                                                                                              |

**Verdict: redo from scratch.** The only thing that carries over is the direction (compose-cli +
`loadJSONSchemaSubgraph`), and the plan below keeps it. The `mesh-v1-migration` branch was therefore
reset onto `main` (old head: `5841b21a`), and #529 continues from there with this plan as its first
commit.

## 5. Plan

### Phase 0: decisions

1. **Retire `hashavshevet-mesh` and `payper-mesh`?** Recommended: yes. If either must stay, the port
   is feasible: the in-context SDK, `{context.hashavshevetUrl}` in the endpoint host and
   form-urlencoded bodies were all verified in a scratch test. But its resolvers would lose v0's
   generated typings.
2. **Codegen flavor.** Recommended: keep the migration PR type-neutral with the v5 plugins v0
   already bundles, then move to v6 as a follow-up. Alternative: go straight to v6 if the `server`
   type fallout turns out to be trivial.
3. **Operations.** Auto-generate them at depth 5 for parity. Hand-written documents can come later.

### Phase 1: retire `hashavshevet-mesh` and `payper-mesh` (PR A, independent)

- Delete both packages.
- Remove them from root `build:tools`, the root `tsconfig.json` paths and the `CLAUDE.md`
  "Integrations" line.
- Add an empty changeset (`yarn changeset --empty`) to satisfy `require-changeset.yml`.
- Owner action: `npm deprecate` both packages.

### Phase 2: migrate `green-invoice-graphql` (PR B)

**2.1 Dependencies** (exact versions, per repo policy):

- **Remove:** `@graphql-mesh/cli`, `config`, `cross-helpers`, `http`, `json-schema`, `runtime`,
  `store`, `types`, `utils`. Also remove the unused `path`, `mime-types` and `@types/mime-types`.
- **Add (runtime):** `@graphql-mesh/fusion-runtime@1.12.1`, `@graphql-mesh/transport-rest@0.12.2`.
- **Add (dev):**
  - `@graphql-mesh/compose-cli@1.8.2`, `@omnigraph/json-schema@0.112.4`
  - `@graphql-codegen/cli@7.4.1` (same as root)
  - `@graphql-codegen/typescript@5.0.10`, `@graphql-codegen/typescript-operations@5.1.0`
  - `@graphql-codegen/typescript-generic-sdk@5.0.1`
  - `@graphql-tools/utils@12.0.1`

**2.2 `mesh.config.ts`** at the package root:

1. Scaffold it with `mesh-migrate-config`.
2. Drop the `gatewayConfig` export (the package runs in-process; no Hive Gateway).
3. Resolve refs from the package root.
4. Delete `src/.meshrc.yaml`.

```ts
import { defineConfig } from '@graphql-mesh/compose-cli'
import { loadJSONSchemaSubgraph } from '@omnigraph/json-schema'

export const composeConfig = defineConfig({
  cwd: import.meta.dirname, // JSON-schema refs resolve from the package root
  subgraphs: [
    {
      sourceHandler: loadJSONSchemaSubgraph('GreenInvoice', {
        endpoint: 'https://api.greeninvoice.co.il/api/v1',
        operationHeaders: {
          Authorization: 'Bearer {context.authToken}',
          'Content-Type': 'application/json'
        },
        operations: [
          {
            type: 'Query',
            field: 'getDocument',
            path: '/documents/{args.id}',
            method: 'GET',
            argTypeMap: { id: { type: 'string', nullable: false } },
            responseSchema: './json-schemas/greenInvoice.json#/$defs/getDocumentResponse'
          }
          // …the other operations, unchanged from src/.meshrc.yaml
        ]
      })
    }
    // GreenInvoiceNew (apigw.greeninvoice.co.il): getFileUploadUrl, getBankTransactions
  ]
})
```

**2.3 Generation pipeline.** All outputs go under `src/__generated__/`, which `**/__generated__/` in
`.gitignore` already covers.

```jsonc
"generate": "rimraf src/__generated__ && mkdir -p src/__generated__ && mesh-compose -o src/__generated__/supergraph.graphql && node scripts/generate-sdk-inputs.ts && graphql-codegen --config codegen.ts"
```

`scripts/generate-sdk-inputs.ts` replaces v0's `sdk.generateOperations` (same algorithm, same
depth). The spike produced byte-identical operations with it:

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { buildSchema, print } from 'graphql'
import { buildOperationNodeForField, getRootTypeMap } from '@graphql-tools/utils'

const dir = new URL('../src/__generated__/', import.meta.url)
const sdl = readFileSync(new URL('supergraph.graphql', dir), 'utf8')
// Runtime imports the supergraph as a module, so nothing has to be copied into dist
writeFileSync(new URL('supergraph.ts', dir), `export default ${JSON.stringify(sdl)};\n`)
const schema = buildSchema(sdl, { assumeValidSDL: true })
const operations = [...getRootTypeMap(schema)].flatMap(([kind, rootType]) =>
  Object.keys(rootType.getFields()).map(field =>
    print(buildOperationNodeForField({ schema, kind, field, depthLimit: 5 }))
  )
)
writeFileSync(new URL('operations.graphql', dir), operations.join('\n\n'))
```

`codegen.ts` (package-local) mirrors the settings `@graphql-mesh/cli` used internally, so exported
names and shapes don't change:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli'

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
          Date: 'string',
          NonNegativeFloat: 'number',
          NonNegativeInt: 'number',
          PositiveFloat: 'number',
          PositiveInt: 'number'
        }
      }
    }
  }
}
export default config
```

**2.4 Runtime.** Add `src/mesh-client.ts`. `src/index.ts` keeps `init(id, secret)` →
`{ sdk, authToken }` and changes only its imports: `getMeshSDK` from `./mesh-client.js`, and
`export * from './__generated__/sdk.js'`.

```ts
import { getSdkRequesterForUnifiedGraph } from '@graphql-mesh/fusion-runtime'
import * as restTransport from '@graphql-mesh/transport-rest'
import supergraph from './__generated__/supergraph.js'
import { getSdk, type Sdk } from './__generated__/sdk.js'

/** `fetch` is optional; tests use it to run offline */
export type GreenInvoiceContext = { authToken: string; fetch?: typeof fetch }

// Built once per process: the v1 counterpart of v0's cached getBuiltMesh()
const requester = getSdkRequesterForUnifiedGraph({
  getUnifiedGraph: () => supergraph,
  transports: { rest: restTransport } // explicit, instead of a name-based dynamic import
})

/** Same contract as v0's getMeshSDK(globalContext): the context fills `{context.authToken}` */
export function getMeshSDK(context: GreenInvoiceContext): Sdk {
  return getSdk((document, variables, operationContext?: object) =>
    requester(document, variables, { ...context, ...operationContext })
  )
}
```

**2.5 Build and publish:**

- Drop `bob.build.copy` (the JSON schemas are compose-time only; the supergraph is a TS module).
- Add a `minor` changeset for `@accounter/green-invoice-graphql`: the dependencies are replaced, the
  public API is unchanged.

**2.6 Tests.** Add a Vitest spec that injects `fetch` through the context. It should cover:

- auth headers
- `jsonStringify` / `brackets` query strings
- the 404 union vs. throw behavior
- enum mangling

This ports the spike harness. The package has no unit tests today, only the dev e2e.

**2.7 Validation:**

1. `yarn build`: this is the CI gate, and it type-checks `server` against the new SDK.
2. Diff the schema against v0's `schema.graphql` with `graphql-inspector`. Expected differences:
   only the `@oneOf` input and internal directives.
3. Run `yarn workspace @accounter/green-invoice-graphql test` (the dev e2e) with real credentials.
4. Smoke-test on staging:
   - issue a document (preview → add → close)
   - client sync (add / update / delete)
   - an expense draft upload (`getFileUploadUrl` + drafts search)
   - download links

### Phase 3: cleanup and follow-ups

- Once no v0 package remains:
  - delete `scripts/mesh-artifacts-rename.mjs` and the root `mesh:artifacts-rename` script;
  - drop `**/.mesh` and `**/mesh-artifacts` from `.gitignore`;
  - update `CLAUDE.md`, and add a package `CLAUDE.md` saying to "run `generate` after editing
    `mesh.config.ts` or `json-schemas/`".
- Move the SDK codegen to v6 plugins (two files: `typescript` → `schema-types.ts`;
  `typescript-operations` + `typescript-generic-sdk` → `sdk.ts`; curated re-exports). Then fix the
  nullability fallout in `server`.
- Optional:
  - generate only the 13 operations `server` uses, or hand-write tighter documents;
  - switch to `createGatewayRuntime({ supergraph }).sdkRequester` if gateway plugins (timeouts,
    retries) are ever wanted. It has the same `getSdk` contract.

## 6. Risks

| Risk                                                                                  | Mitigation                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| The migration guide is labelled "Experimental – Beta"                                 | The pieces used here (compose-cli 1.x, fusion-runtime, the JSON Schema engine) are GA. v0 stays maintained, so this can wait for a good moment |
| Runtime behavior the mocks don't cover (error texts, timeouts, uncommon status codes) | Dev e2e against the real API plus the staging smoke test                                                                                       |
| Name drift in future `@omnigraph/json-schema` releases                                | Exact pins (repo policy). On every Renovate bump, `yarn build` type-checks `server` against the regenerated SDK                                |
| `@oneOf` lost on the `updateExpense` input                                            | Unused by `server`; report upstream if it matters                                                                                              |
| Two codegen majors in the repo during the interim                                     | Time-boxed by the Phase 3 follow-up                                                                                                            |

Rough size: Phase 1 is S (about half a day). Phase 2 is M (1–2 days including validation). Phase 3
is S–M.

## 7. Not verified

- `server`'s full `tsc` against the new SDK. That needs the whole monorepo installed and a database
  for PgTyped. The type-level evidence is the assignability check in §3; `yarn build` is the real
  test.
- Calls against the real Green Invoice API (no credentials were available); all runtime checks used
  mocked responses.
