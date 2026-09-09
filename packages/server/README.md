# @accounter-helper/server

## Building

```bash
yarn workspace @accounter/server build
```

`build` is a single `tsc -p tsconfig.build.json` pass — there is no post-processing step. The
emitted tree mirrors `src`, so the entry points are `dist/index.js` and
`dist/bootstrap-telemetry.js`.

Two tsconfigs, on purpose:

| File                  | Used by                   | Program                                      |
| --------------------- | ------------------------- | -------------------------------------------- |
| `tsconfig.json`       | editors, `yarn typecheck` | all of `src`, tests included                 |
| `tsconfig.build.json` | `yarn build`              | `src` minus tests, `rootDir` pinned to `src` |

The build config exists because the test helpers under `src/__tests__` import
`packages/migrations/src` directly. Any file outside `src` in the program pushes `rootDir` up to
`packages/`, which is what used to bury the entry point at `dist/server/src/index.js`.

### Build the workspace generators first

The server imports four sibling packages by name:

- `@accounter/green-invoice-graphql`
- `@accounter/pcn874-generator`
- `@accounter/shaam6111-generator`
- `@accounter/shaam-uniform-format-generator`

These resolve through the workspace `node_modules` symlinks and each package's own `exports`, whose
`types` and `import` conditions both point into `dist`. So **their `dist` has to exist before the
server type-resolves at all** — this applies equally to `yarn build` and `yarn typecheck`, since
both read the same module resolution. Either one, run against unbuilt generators, fails with
`TS2307: Cannot find module '@accounter/...'` (plus knock-on `TS7006`s wherever an inferred type
came from a generator).

Every pipeline already orders this correctly — root `yarn build` runs `build:tools` before
`build:main`, and `yarn workspace @accounter/server server:build:prod` builds the four explicitly.
Only hand-run commands in a fresh clone need care:

```bash
yarn build:tools # once, before either of the next two
yarn workspace @accounter/server build
yarn workspace @accounter/server typecheck
```

### The dev loop and the generators

`yarn dev` watches the server's own `src` **and** the four generators' `dist` directories, so the
loop differs depending on what you edit:

| You edit                 | What happens                                                            |
| ------------------------ | ----------------------------------------------------------------------- |
| `packages/server/src/**` | nodemon rebuilds and restarts the server                                |
| a generator's `src/**`   | nothing — until you build that generator, which then triggers the above |

```bash
yarn workspace @accounter/pcn874-generator build # server rebuilds and restarts on its own
```

There is no watch on the generators' _source_: `bob build` has no watch mode, and rebuilding all
four on every server-source save would cost more than it saves. Watching their build output instead
means one explicit generator build is all it takes.

Note that nodemon's `--ignore` patterns are **not** anchored to the package directory — an
`--ignore 'dist/**'` here would also silently swallow `../<generator>/dist/**` and break these
watches. The server's own `dist` needs no ignore rule, as it is not under any `--watch` path.

## Super-Admin & Client Onboarding

Super-admins are platform operators identified by their Auth0 user ID in the `super_admins` DB
table. They are the only users who can call the `bootstrapNewClient` mutation to provision a new
tenant from scratch.

### Registering a Super-Admin

```bash
AUTH0_USER_ID='auth0|<id>' yarn @accounter/server seed:super-admin
```

The app DB user has no INSERT privilege on `super_admins` (RLS-enforced); this script uses the
DBA-level credentials from `.env`.

### Bootstrapping a New Client

Call the `bootstrapNewClient` GraphQL mutation as a super-admin. It creates the full tenant setup in
one transaction: admin business entity, authority businesses, all required tax categories,
`user_context`, and an Auth0 invitation for the new owner.

See the full operational runbook at
[docs/super-user/super-admin-runbook.md](../../docs/super-user/super-admin-runbook.md).

---

## Observability

The server supports OpenTelemetry tracing export over OTLP/HTTP. Configuration is read from the
repository-level `.env` file through [packages/server/src/environment.ts](src/environment.ts).

### Environment Variables

- `OTEL_ENABLED`: Enables tracing when set to `1`. Default: `0`.
- `OTEL_SERVICE_NAME`: Service name attached to emitted spans. Default: `accounter-server`.
- `OTEL_SERVICE_NAMESPACE`: Service namespace attached to emitted spans. Default: `accounter`.
- `OTEL_DEPLOYMENT_ENV`: Deployment environment attribute. Defaults to `NODE_ENV` or `development`.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP/HTTP trace endpoint. Required when `OTEL_ENABLED=1`.
- `OTEL_EXPORTER_OTLP_HEADERS`: Optional comma-separated `key=value` header string for exporter auth
  or tenant routing.
- `OTEL_TRACES_SAMPLER`: Trace sampler strategy. Supported values: `parentbased_traceidratio`,
  `always_on`, `always_off`. Default: `always_on`.
- `OTEL_TRACES_SAMPLER_ARG`: Optional numeric ratio from `0` to `1` used with
  `parentbased_traceidratio`.
- `OTEL_STARTUP_STRICT`: Optional strict startup flag. When `true`, invalid OTEL startup causes the
  server to fail fast. When omitted or `false`, the server logs and continues without tracing.

### Local Tracing

To enable tracing locally:

1. Run a local OTLP-compatible backend such as Grafana Tempo or Jaeger all-in-one with OTLP/HTTP
   enabled.
2. Add the OTEL variables to the repository `.env` file.
3. Set `OTEL_ENABLED=1` and point `OTEL_EXPORTER_OTLP_ENDPOINT` to the collector's HTTP ingest
   endpoint.
4. Start the server normally and execute a few GraphQL operations.
5. Open your tracing UI and filter by service name `accounter-server`.

Typical local endpoints:

- Tempo via OTLP/HTTP: `http://localhost:4318/v1/traces`
- Jaeger all-in-one with OTLP enabled: `http://localhost:4318/v1/traces`

For local development, `OTEL_TRACES_SAMPLER=always_on` is the simplest option. For shared
environments, prefer `parentbased_traceidratio` with a conservative ratio such as `0.1`.

### Example `.env`

```dotenv
OTEL_ENABLED=1
OTEL_SERVICE_NAME=accounter-server
OTEL_SERVICE_NAMESPACE=accounter
OTEL_DEPLOYMENT_ENV=development
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_TRACES_SAMPLER=always_on
OTEL_STARTUP_STRICT=false
```

## Test Suites

The test suite is split into three Vitest projects for efficiency and isolation:

### 1. Unit Tests (`yarn test`)

Fast, isolated tests with no external dependencies. Runs by default and excludes DB-backed tests and
demo fixtures.

### 2. Integration Tests (`yarn test:integration`)

DB-backed tests including:

- Server helpers and test harness (`packages/server/src/__tests__/**`)
- Module integration tests (`packages/server/src/modules/**/*.integration.test.ts`)

**Prerequisites:**

- PostgreSQL running
- Migrations applied (see below)

### 3. Demo Seed E2E (`yarn test:demo-seed`)

Full seed-and-validate pipeline test that:

- Seeds complete demo dataset
- Validates data integrity and ledger balance
- Takes 10-30 seconds to complete

**Prerequisites:**

- PostgreSQL running
- Migrations applied
- `ALLOW_DEMO_SEED=1` environment variable

**Graceful Failure**: If migrations are stale, the test fails with a clear error message directing
you to run migrations, rather than hanging or producing cryptic errors.

### Running Tests

```bash
# Fast unit tests only (default)
yarn test

# Unit + integration tests (for PRs)
yarn test:integration

# Demo seed E2E only
ALLOW_DEMO_SEED=1 yarn test:demo-seed
```

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

The harness supports setting a custom env file via `TEST_ENV_FILE`.

Example (manual):

```
TEST_ENV_FILE=/tmp/accounter-test.env DEBUG=accounter:test yarn workspace @accounter-helper/server test
```

The global Vitest setup may set `TEST_ENV_FILE` automatically to a temporary path; check logs if
needed. If the write fails, tests continue (non-fatal). To disable writing entirely you can point
`TEST_ENV_FILE` to a throwaway location.

## Demo Staging Dataset

The demo staging dataset system provides **use-case-driven financial scenarios** for staging
environments. Each use-case represents a complete financial scenario (expense, income, equity, etc.)
that can be seeded with deterministic UUIDs for stable demo data across deployments.

### Quick Start

```bash
# Seed demo data (staging/local only - requires explicit flag)
ALLOW_DEMO_SEED=1 yarn seed:staging-demo

# Validate seeded data integrity
yarn validate:demo

# Combined workflow (recommended)
ALLOW_DEMO_SEED=1 yarn seed:staging-demo && yarn validate:demo
```

### Key Features

- **Deterministic UUIDs**: Stable entity IDs via UUID v5 generation
- **Modular Registry**: Self-contained use-case fixtures with metadata
- **Production Safeguards**: Hard refusal to run in production environments
- **Comprehensive Validation**: Ledger balance checks, entity reconciliation

### Documentation

- **Specification**: `docs/demo-staging-dataset-spec.md` – Complete technical specification
- **Developer Guide**: `packages/server/docs/demo-staging-guide.md` – Quick start, adding use-cases,
  troubleshooting
- **Implementation Plan**: `docs/demo-staging-dataset-prompt-plan.md` – Step-by-step prompts
- **Progress Tracking**: `docs/demo-staging-dataset-todo.md` – Implementation checklist

### Architecture

```
Use-Case Registry → Seed Orchestrator → Validation Layer
(TypeScript modules)  (seed-demo-data)   (validate-demo)
```

See the [Developer Guide](./docs/demo-staging-guide.md) for detailed instructions on adding new
use-cases and troubleshooting.

---

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
