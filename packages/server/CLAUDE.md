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
- DataLoader `.load()` return types are **not uniform**: some id-loaders (e.g.
  `TransactionsProvider.transactionByIdLoader`) are typed `T | Error` because the batch fn returns
  `Error` for missing keys — `.load()` rejects at runtime but the compiler still sees `T | Error`, so
  narrow with `instanceof Error` before accessing fields. Others (e.g. `ChargesProvider`
  `getChargeByIdLoader`, `DocumentsProvider.getDocumentsByIdLoader`) return `T | undefined`. Check the
  batch function before assuming.

## Resolver Patterns

- Always destructure `{ injector }` from context.
- Access providers via `injector.get(ProviderClass)`.
- Import resolver types from `__generated__/types`.

## Auth

Modules under `src/modules/auth/` handle authentication and authorization.

## Accountant approval (charge-mutating ops)

An approved charge must be re-flagged for review when its underlying data changes. Any operation that
mutates a charge's composition — documents, transactions, misc-expenses, ledger regeneration, charge
updates/merges — must call the shared helper
`degradeChargesAccountantApproval(injector, chargeIds)`
(`src/modules/accountant-approval/helpers/degrade-charges.helper.ts`) after the mutation succeeds. It
degrades `APPROVED → PENDING`, de-dupes ids, ignores empty/`EMPTY_UUID` ids (degrading a
non-approved/new charge is a no-op), and returns the freshly-degraded charges so the resolver can
respond with up-to-date status instead of a stale pre-degrade object.

- Exclusions on `updateCharge`/`batchUpdateCharges`: **tag-only** changes and **explicit
  accountant-approval** changes do not degrade (see `chargeUpdateRequiresApprovalDegrade`).
- Apply at the **resolver** layer, not in data-access providers: the underlying provider method
  (`AccountantApprovalProvider.degradeChargeAccountantApproval`) calls `canWriteCharge()`, which
  requires an authenticated role, so provider-level hooks would break role-less internal/batch flows;
  it also avoids a DI cycle (the provider already depends on `ChargesProvider`).

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
