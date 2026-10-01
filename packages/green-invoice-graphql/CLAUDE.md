# green-invoice-graphql

GraphQL Mesh v1 client for the Green Invoice REST API, consumed in-process by `@accounter/server`.
See `README.md` for how generation works.

- After editing `mesh.config.ts` or `json-schemas/`, run
  `yarn workspace @accounter/green-invoice-graphql generate`. Everything in `src/__generated__/` is
  generated and git-ignored — never edit it.
- `@accounter/server` imports generated names (`_DOLLAR_defs_*` types, `<field>_query` /
  `<field>_mutation` SDK methods, `'_305'`-style enum values). Renaming a JSON-schema definition or
  an operation field renames them too, so check the server with
  `yarn workspace @accounter/server typecheck` after building this package.
- The `@graphql-codegen/typescript` and `typescript-operations` plugins are pinned to v5 on purpose:
  they are the majors Mesh v0 generated with, so the output types match what the server was written
  against. v6 needs a two-file layout and tightens nullability (see
  `docs/mesh-v1-migration/plan.md`, Phase 3).
- Unit tests (`src/__tests__`) inject `fetch` through the SDK context and never call the real API.
  `yarn workspace @accounter/green-invoice-graphql test` runs the compiled `src/dev-tests/e2e.ts`
  (build first) against the real API and needs `GREEN_INVOICE_ID` / `GREEN_INVOICE_SECRET`.
