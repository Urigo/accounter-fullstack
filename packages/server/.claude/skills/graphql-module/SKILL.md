---
name: graphql-module
description:
  When creating, modifying, or debugging GraphQL modules, resolvers, providers, or type definitions
  in the server package
---

# GraphQL Module Patterns

## Module Anatomy

Each module in `src/modules/<name>/` contains:

- `typeDefs/<name>.graphql.ts` — schema using `gql` tag from `graphql-modules`
- `resolvers/<name>.resolver.ts` — query, mutation, and field resolvers
- `providers/<name>.provider.ts` — data access layer with `@Injectable()`
- `helpers/` — module-specific utility functions
- `types.ts` — re-exports generated types from `__generated__/`
- `index.ts` — `createModule()` registration

See `references/` for annotated examples of each file.

## Provider Injection

- Providers use `@Injectable({ scope: Scope.Operation, global: true })` from `graphql-modules`
- Constructor injection for dependencies: `constructor(private db: TenantAwareDBClient, ...)`
- Database access via `TenantAwareDBClient` (tenant-scoped) — never raw Postgres clients
- Admin context via `AdminContextProvider` when owner/tenant ID is needed

## DataLoader for N+1 Prevention

- Every provider that fetches by ID must expose a DataLoader
  (`new DataLoader(keys => this.batchFn(keys))`)
- Batch function receives `readonly` array of keys, returns results in matching order
- Prime the loader cache when fetching all records (e.g., `getAll` primes individual loaders)
- Call `clearAll()` on loaders after mutations to invalidate cache

## Field Resolvers

- Field resolvers on extended types resolve cross-module relationships
- Access the parent's DB fields (snake_case) to load related data via providers
- Return `null` explicitly when the foreign key is missing — don't throw

## Type Generation

- Types come from `__generated__/types.ts` (graphql-codegen) and `__generated__/<name>.types.ts`
  (pgtyped)
- Module resolver type: `<ModuleName>Module.Resolvers` from `./types.js`
- Never hand-write GraphQL resolver types — always import generated ones
- Run `yarn generate` after any schema or SQL change

## Gotchas

- Always import with `.js` extension — even for `.ts` source files (ESM requirement)
- Never access DB directly from resolvers — always go through providers
- `__generated__/` is git-ignored — run `yarn generate` before working on a module for the first
  time
- Provider classes must have `@Injectable()` decorator or DI fails silently at runtime
- SQL queries use `@pgtyped/runtime`'s `sql` tagged template — types are generated from the SQL, not
  hand-written
- Auth directives (`@requiresAuth`, `@requiresAnyRole`) go on schema fields, not in resolver code
- `Scope.Operation` ensures one provider instance per GraphQL operation (request-scoped)
