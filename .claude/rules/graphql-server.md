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
