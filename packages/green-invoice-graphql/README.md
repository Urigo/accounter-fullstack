# green-invoice-graphql

Typed GraphQL client for Green Invoice's REST APIs, built with
[GraphQL Mesh v1](https://the-guild.dev/graphql/mesh/v1/local-execution). It runs in-process; there
is no gateway server.

## How it works

`yarn generate` (also run by `yarn build`) produces everything under `src/__generated__/`
(git-ignored):

1. `mesh-compose` composes the operations in `mesh.config.ts` and the JSON schemas in
   `json-schemas/` into `supergraph.graphql`. The JSON schemas are only read at this step.
2. `scripts/generate-sdk-inputs.ts` writes the supergraph as a module (`supergraph.ts`) and derives
   one operation per root field (`operations.graphql`), named `<field>_query` / `<field>_mutation`.
3. GraphQL Code Generator (`codegen.ts`) turns those into the typed SDK (`sdk.ts`).

At runtime, `getMeshSDK({ authToken })` (or `init(id, secret)`, which obtains the token first)
executes the SDK's operations against the supergraph with `@graphql-mesh/fusion-runtime`. The
context fills `{context.authToken}` in the request headers, and an optional `fetch` in the context
replaces the HTTP client (see `src/__tests__`).

To add or change an endpoint, edit `mesh.config.ts` (and the JSON schema), then run `yarn generate`.
The generated names follow the JSON schema (e.g. `_DOLLAR_defs_Document` for `#/$defs/Document`,
`'_305'` for the numeric enum value `305`), and `@accounter/server` depends on them.

# issues with green invoice

1. on file upload (draft expense) - some details are responded (successful import), but file is
   missing from the drafts search
2. on file upload (draft expense) - an ID is returned. this ID doesn't exist on getExpense. search
   drafts doesn't return IDs. so what is it used for?
3. why is most of the expense data missing on response of searchDrafts?
4. Is there swagger / json schema / postman collection to the entire collection
