# Server Package

GraphQL API built with `graphql-modules`, Postgres, and `graphql-codegen`.

## Module Structure

Each module in `src/modules/<name>/` contains:

- `typeDefs/*.graphql.ts` — schema definitions using `gql` tag from `graphql-modules`
- `resolvers/*.resolver.ts` — query, mutation, and field resolvers
- `providers/*.provider.ts` — data access layer with `@Injectable()` decorator
- `helpers/*.helper.ts` (optional) — shared helper functions for resolvers/providers
- `types.ts` — centralizes re-exports of module-related types (from `__generated__/` and custom
  wrappers)
- `index.ts` — module registration via `createModule()`

## Existing Modules (33)

accountant-approval, admin-context, app-providers, auth, bank-deposits, business-trips, charges,
charges-matcher, charts, common, contracts, corn-jobs, corporate-taxes, countries, deel,
depreciation, dividends, documents, exchange-rates, financial-accounts, financial-entities,
gmail-listener, green-invoice, ledger, misc-expenses, priority, reports, salaries, sort-codes, tags,
transactions, vat, workspace-settings

## Provider Patterns

- Must have `@Injectable()` decorator — DI fails silently without it.
- Inject TenantAwareDBClient via constructor for DB access.
- Use DataLoader pattern for N+1 prevention in field resolvers.
- Resolvers must never query the DB directly — always go through providers.

## Resolver Patterns

- Always destructure `{ injector }` from context.
- Access providers via `injector.get(ProviderClass)`.
- Import resolver types from `__generated__/types`.

## Auth

Modules under `src/modules/auth/` handle authentication and authorization.

## Testing

- Unit tests: `yarn test`
- Integration tests: `yarn test:integration`
- Server tests use injector-based setup.

## Commands

```bash
yarn workspace @accounter/server build # Build server
yarn seed:admin-context                # Seed admin context
yarn generate                          # Regenerate types after schema changes
```
