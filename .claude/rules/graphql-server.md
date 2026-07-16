---
paths:
  - 'packages/server/src/modules/**/*.ts'
---

# GraphQL Server Module Conventions

## Module Structure

Each module in `packages/server/src/modules/<name>/` contains:

- `typeDefs/<name>.graphql.ts` — schema definitions using `gql` tag from `graphql-modules`
- `resolvers/` — query, mutation, and field resolvers
- `providers/<name>.provider.ts` — data access layer with `@Injectable()` decorator
- `helpers/` (optional) — shared helper functions used across resolvers/providers, or to break up
  large resolvers for readability
- `types.ts` — centralizes re-exports of module-related types (from `__generated__/` and custom
  wrappers)
- `index.ts` — module registration via `createModule()`

## Resolver Patterns

- Signature: `async (_parent, args, { injector }) => ...`
- Always access providers via `injector.get(ProviderClass)` — never instantiate directly.
- Import resolver types from `__generated__/types`:
  ```typescript
  import { QueryResolvers } from '../../../../__generated__/types.js'
  export const myQuery: QueryResolvers['myQuery'] = async (_parent, { id }, { injector }) => {
    return injector.get(MyProvider).getById(id)
  }
  ```
- Field resolvers follow the same pattern with parent-specific types:
  ```typescript
  import { ExampleResolvers } from '../../../__generated__/types.js'
  export const Example: ExampleResolvers = {
    owner: async (parent, _args, { injector }) => {
      return injector.get(FinancialEntitiesProvider).getEntityById(parent.ownerId)
    }
  }
  ```

## Provider Patterns

- Must have `@Injectable()` decorator (DI fails silently without it).
- Inject `TenantAwareDBClient` via constructor. Never query the DB directly from resolvers.
  ```typescript
  import { Injectable } from 'graphql-modules'
  @Injectable()
  export class ExampleProvider {
    constructor(private db: TenantAwareDBClient) {}
  }
  ```
- DataLoader `.load()` return types are **not uniform** across providers. Some id-loaders (e.g.
  `TransactionsProvider.transactionByIdLoader`) are typed `T | Error` because the batch fn returns an
  `Error` for missing keys — `.load()` rejects at runtime, but the compiler still sees `T | Error`, so
  narrow with `instanceof Error` before reading fields. Others (e.g. `ChargesProvider`
  `getChargeByIdLoader`, `DocumentsProvider.getDocumentsByIdLoader`) return `T | undefined`. Check the
  batch function before assuming.

## GraphQL Schema Naming

- **Types**: PascalCase (`BusinessTransaction`)
- **Fields & arguments**: camelCase (`transactionDate`)
- **Enums**: ALL_CAPS values (`PENDING`, `COMPLETED`)
- **Input types**: descriptive PascalCase (`CreateTransactionInput`, `AmountInput`)

## Error Handling

Use union types for operation results:

```graphql
type CommonError {
  message: String!
}
union CreateTransactionResult = Transaction | CommonError
```

## Type Generation

Run `yarn generate` after any typeDefs change. Types are generated to `__generated__/types` — never
hand-write resolver or schema types.

## Accountant Approval (charge-mutating ops)

An `APPROVED` charge must be re-flagged for review when its underlying data changes. Any operation
that mutates a charge's composition — documents, transactions, misc-expenses, ledger regeneration,
charge updates/merges — must call the shared helper after the mutation succeeds:

```typescript
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js'
// ...after the write succeeds:
const degraded = await degradeChargesAccountantApproval(injector, [chargeId /*, ...*/])
return { charge: degraded.get(chargeId) ?? charge } // respond with fresh status, not the stale object
```

- Degrades `APPROVED → PENDING`; de-dupes ids and ignores empty/`EMPTY_UUID` ids (degrading a
  non-approved or newly-generated charge is a no-op). Pass both the former and new charge when a
  record moves between charges.
- Returns a `Map` of the charges actually degraded, carrying their fresh `PENDING` state — use it so
  the resolver responds with up-to-date status instead of a pre-degrade object.
- On `updateCharge` / `batchUpdateCharges`, **tag-only** and **explicit accountant-approval** changes
  must not degrade (see `chargeUpdateRequiresApprovalDegrade`).
- Apply at the **resolver** layer, not in data-access providers:
  `AccountantApprovalProvider.degradeChargeAccountantApproval` calls `canWriteCharge()` (requires an
  authenticated role), so provider-level hooks would break role-less internal/batch flows; it also
  avoids a DI cycle (the provider already depends on `ChargesProvider`).
