# Server Demo Test Data Implementation Guide

This guide complements the high-level specification in `docs/demo-test-data-plan.md` by documenting
the server-specific implementation details colocated with code.

## 1. Scope & Purpose

Focus on mechanics inside `packages/server`:

- Seed script & admin context (`seed-admin-context.ts`)
- Test DB harness modules (connection, migrations, fixtures, diagnostics, errors)
- Factories & fixture loader internals
- Ledger injector & integration test strategy
- Environment isolation & diagnostics toggles

## 2. Directory Map

```
packages/server/
  scripts/seed-admin-context.ts        # Admin context seeding (idempotent)
  src/__tests__/helpers/               # Harness modules & utilities
  src/__tests__/factories/             # Deterministic data factories
  src/__tests__/fixtures/              # Scenario fixtures (A, B, ...)
  src/test-utils/ledger-injector.ts    # Provider DI harness for ledger tests
  docs/ledger-integration/             # Ledger testing plans & refactor spec
  docs/implementation-guide.md         # (this file)
```

## 3. Seed Flow (`seed-admin-context.ts`)

Steps performed (transactional recommended for tests):

1. Upsert reference country `ISR` to satisfy new FK constraints.
2. Ensure financial entity for Admin Business.
3. Ensure authority businesses (VAT, Tax, Social Security).
4. Ensure general & cross-year tax categories.
5. Upsert `user_context` with defaults (local currency ILS).
6. Write `DEFAULT_FINANCIAL_ENTITY_ID` to env file (isolated if `TEST_ENV_FILE` set; atomic write
   pattern).

Idempotency: All helpers perform `SELECT` checks before `INSERT` or rely on
`ON CONFLICT DO NOTHING`.

## 4. Test DB Harness Modules

| Module                | Responsibility                                                    |
| --------------------- | ----------------------------------------------------------------- |
| `db-connection.ts`    | Pool creation, retry/backoff, health metrics                      |
| `db-migrations.ts`    | Latest migration name assertion (no auto-run)                     |
| `db-fixtures.ts`      | One-time admin seeding (`seedAdminOnce`) with metrics             |
| `test-transaction.ts` | Transaction wrappers (BEGIN/ROLLBACK)                             |
| `diagnostics.ts`      | Conditional debug logging & pool metrics (`DEBUG=accounter:test`) |
| `errors.ts`           | Structured error types (`TestDbConnectionError`, etc.)            |
| `test-database.ts`    | Facade class orchestrating lifecycle                              |

Activation: Set `DEBUG=accounter:test` to enable diagnostic emission.

## 5. Factories & Determinism

Factories leverage seeded UUIDs via `makeUUID(seed)` for reproducibility. Numeric handling uses
`formatNumeric()` for pgtyped `numeric` columns; dates normalized with `iso()`.

Patterns:

- Minimal required shape; optional fields nullable.
- `Partial<T>` override acceptance ensures low ceremony scenario creation.
- Never depend on implicit DB defaults for test determinism.

## 6. Fixture Loader Internals

Insertion order (with savepoints):
`financial_entities → businesses → tax_categories → financial_accounts (+ join mappings) → charges → transactions → documents`

Features:

- Pre-validation (`validateFixture`) prevents FK errors early.
- Account number → UUID resolution for transaction foreign keys.
- Automatic `etherscan_id` generation to bypass triggers.
- Savepoint rollback on section failure; enriched error context.

Deferred: `clearData()` utility (not critical due to transaction isolation strategy).

## 7. Ledger Injector (`ledger-injector.ts`)

Avoids full GraphQL application boot:

- Instantiates only needed providers.
- Builds `adminContext` from DB (`user_context` + entities) rather than env.
- Supports exchange rate mocking via `mockExchangeRate` injection.

Usage Pattern:

```typescript
const { injector, adminContext } = createLedgerTestContext({ pool, mockExchangeRates });
const result = await ledgerGenerationByCharge({ chargeId }, { injector, adminContext });
```

## 8. Environment Isolation

- Global vitest setup creates temp env file; sets `TEST_ENV_FILE`.
- Seed writes use atomic helper (`writeEnvVar`).
- Root `.env` remains unchanged during tests, preventing noisy diffs.

## 9. Diagnostics & Errors

- Enable metrics: `DEBUG=accounter:test`
- Sample emissions: connect, seeding-start, seeding-complete, closing.
- Error taxonomy aids quick triage (connection vs migration vs seed).

## 10. Currency & Country Enums

All fixtures/tests use `Currency` and `CountryCode` enums to replace magic strings, enabling IDE
autocomplete and compile-time safety.

## 11. Adding a New Scenario (Checklist)

1. Define fixture file under `src/__tests__/fixtures/…` using factories.
2. Run `validateFixture` in a dedicated test.
3. If ledger scenario: extend injector usage test; assert semantic correctness (entity roles,
   balance).
4. Mock exchange rates if foreign currency involved.
5. Use deterministic UUID seeds for all entities.
6. Add expectations summary to fixture (`expectations.ledger`).

## 12. Troubleshooting

| Symptom                  | Likely Cause               | Action                                               |
| ------------------------ | -------------------------- | ---------------------------------------------------- |
| Migration guard fails    | DB not migrated            | Run migrations workspace command                     |
| Env file polluted        | `TEST_ENV_FILE` not set    | Re-run tests; ensure global setup executes           |
| Duplicate ledger records | Regeneration without guard | Implement planned duplicate prevention (Milestone 7) |
| Foreign totals off       | Exchange mock missing      | Inject `mockExchangeRate` with correct pair          |
| Provider missing error   | New dependency added       | Add provider case to injector factory                |

## 13. Future Enhancements

See Milestone 7 (Ledger Coverage Hardening) for upcoming ledger correctness goals (duplicate
prevention, VAT, multi-leg foreign fees, locking tests).

## 14. References

- High-level spec: `docs/demo-test-data-plan.md`
- Prompt log: `docs/demo-test-data-prompt-plan.md`
- Checklist: `docs/demo-test-data-todo.md`
- Ledger plans: `packages/server/docs/ledger-integration/*`

---

Maintainers: Update this guide when adding providers, factories, or significant ledger behaviors.
