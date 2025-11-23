# @accounter-helper/server

## Test DB Harness

This package includes a Vitest-friendly PostgreSQL test harness with:

- Shared Pool connection with health checks and retries
- Transaction helpers (`withTransaction`) to isolate changes per test
- Admin context seeding (`seedAdminCore`) for domain fixtures
- Diagnostics when `DEBUG=accounter:test` (pool metrics + lifecycle logs)

### Prerequisite: Latest DB Migrations

Tests assume the database schema is at the latest migration. Tests DO NOT run migrations
automatically (to avoid corrupting populated databases or violating FKs).

Bring your DB to the latest migration using the migrations workspace:

- Fresh DB and migrate up: `yarn workspace @accounter-helper/migrations db:init`

- Migrate existing DB up: `yarn workspace @accounter-helper/migrations migration:run`

If the smoke test fails with "is at latest migration (schema ready)", your DB is behind. Run the
commands above, then re-run tests.

### Running tests with diagnostics

Enable harness diagnostics to see pool metrics and lifecycle events:

`DEBUG=accounter:test yarn workspace @accounter-helper/server test`

### Notes

- Seeding in tests is done inside transactions to prevent cross-test leakage.
- The harness exposes `LATEST_MIGRATION_NAME` so tests can assert exact schema version via
  `accounter_schema.migration`.
- Env file writes during seeding are isolated when `TEST_ENV_FILE` is set; otherwise `.env` in repo
  root is updated.

### Environment File Isolation

By default `seedAdminCore` writes `DEFAULT_FINANCIAL_ENTITY_ID` to the project `.env`. For test runs
this can cause noisy diffs or race conditions in parallel execution. The harness supports setting a
custom env file via `TEST_ENV_FILE`.

Example (manual):

```
TEST_ENV_FILE=/tmp/accounter-test.env DEBUG=accounter:test yarn workspace @accounter-helper/server test
```

The global Vitest setup may set `TEST_ENV_FILE` automatically to a temporary path; check logs if
needed. If the write fails, tests continue (non-fatal). To disable writing entirely you can point
`TEST_ENV_FILE` to a throwaway location.

## Demo Test Data & Ledger Docs

High-level architecture, roadmap and prompts are maintained in root `docs/`:

- `docs/demo-test-data-plan.md` – Overall specification & goals
- `docs/demo-test-data-prompt-plan.md` – TDD prompt history
- `docs/demo-test-data-todo.md` – Progress checklist

Server-local implementation details:

- `packages/server/docs/implementation-guide.md` – Seed, harness, injector, fixtures
- `packages/server/docs/ledger-integration/ledger-integration-plan.md` – Ledger harness plan
- `packages/server/docs/ledger-integration/ledger-tests-refactor-spec.md` – Semantic assertion
  refactor

When adding new scenarios or providers, update the implementation guide and (if ledger-specific) the
ledger integration plan.
