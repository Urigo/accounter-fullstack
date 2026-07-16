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

## Existing Modules (34)

accountant-approval, admin-context, app-providers, auth, bank-deposits, business-trips, charges,
charges-matcher, charts, common, contracts, cron-jobs, corporate-taxes, countries, deel,
depreciation, dividends, documents, email-ingestion, exchange-rates, financial-accounts,
financial-entities, green-invoice, ledger, misc-expenses, priority, reports, salaries, sort-codes,
tags, transactions, vat, workspace-settings

> `gmail-listener` remains as a backward-compat re-export shim
> (`gmailListenerModule = emailIngestionModule`) for the legacy listener package. New code must
> import from `email-ingestion` directly.

## Provider Patterns

- Must have `@Injectable()` decorator — DI fails silently without it.
- Inject TenantAwareDBClient via constructor for DB access.
- Use DataLoader pattern for N+1 prevention in field resolvers.
- Resolvers must never query the DB directly — always go through providers.
- DataLoader `.load()` return types vary — some are `T | Error` (narrow with `instanceof Error`),
  others `T | undefined`. Check the batch fn.

## Resolver Patterns

- Always destructure `{ injector }` from context.
- Access providers via `injector.get(ProviderClass)`.
- Import resolver types from `__generated__/types`.

## Auth

Modules under `src/modules/auth/` handle authentication and authorization.

## Accountant approval

Charge-mutating ops (documents, transactions, misc-expenses, ledger, charge update/merge) must call
`degradeChargesAccountantApproval` after success — see `.claude/rules/graphql-server.md`.

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
