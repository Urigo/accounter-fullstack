# Accounter

Manage your taxes.

## Getting started

1. Switch to the correct version of Node.js:

```sh
nvm use $(cat .node-version)
```

2. Install dependencies:

```sh
yarn install
```

3. Create the `.env` files:

```sh
cp .env.template .env
cp packages/server/.env.template packages/server/.env
cp packages/client/.env.template packages/client/.env
```

The root `.env` holds what several packages share (database, Auth0 domain and audience, scraper
credentials); `packages/server/.env` and `packages/client/.env` hold each app's own settings. Set
shared values once, in the root `.env`: the package templates list them commented out, because a
value in a package `.env` overrides the root one for that package only. Each template documents its
variables.

> **Warning:** the root `.env` is for a **local** database only. Never put production credentials,
> or those of any other deployed database, in it. Codegen, migrations, seeds and every DB-backed
> test read this file, so `yarn test`, `yarn generate` and `migration:run` all run against whatever
> it points at, and some of them write or reset data. See [Database safety](#database-safety).

4. Run setup:

If you want to create new local database, run:

```sh
yarn local:setup
```

> **Note:** the local Postgres data directory lives in `docker/.accounter-dev/postgresql/db` and is
> tied to the major version of the `postgres` image in `docker/docker-compose.dev.yml`. Whenever
> that major version changes (e.g. 16 → 18), the server refuses to start against the old data
> directory — delete `docker/.accounter-dev/postgresql/db` and re-run `yarn local:setup`. It is
> dev-only data.

In case you already have a local database, you can set the database variables in your `.env` file,
then run:

```sh
yarn setup
```

5. Run client and server:

```sh
yarn build
yarn client:dev
yarn server:dev
# Also helpful while developing:
yarn generate:watch
```

Or use the VSCode Terminals extension: `fabiospampinato.vscode-terminals` to run all this for you in
different terminals.

6. Visit [http://localhost:3001/](http://localhost:3001/) and sign in via Auth0 Universal Login.
   Configure Auth0 before running the app: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` and
   `AUTH0_FRONTEND_CLIENT_ID`: the first two in the root `.env` (the server and the client share
   them), the third in `packages/client/.env`. Then set `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` and
   `AUTH0_MANAGEMENT_AUDIENCE` in `packages/server/.env`.

7. Seed the database with your business details. Edit `scripts/seed.ts` with your info, set the
   `SEED_*` variables (bank accounts, cards, currencies; see `.env.template`) in the root `.env`,
   then run `yarn seed:production`.

8. Load your data into the database (first set correct env vars):

```sh
yarn scrape
```

> **Note:** `yarn scrape` runs the deprecated `scraper-local-app` CLI, kept only for rollback.
> Prefer the [`@accounter/scraper-app`](packages/scraper-app/README.md) web app going forward:
>
> ```sh
> yarn workspace @accounter/scraper-app dev:server
> ```

9. Generate businesses by visiting http://localhost:4000/graphql

Set your headers at the bottom:

```json
{
  "authorization": "Basic [YOUR_TOKEN]"
}
```

You can find `YOUR_TOKEN` by in the GraphQL request headers in your browser's `Network` tab.

Then run this mutation:

```gql
mutation {
  batchGenerateBusinessesOutOfTransactions {
    id
    name
  }
}
```

## Authentication

Accounter uses Auth0 for user authentication. See:

- [Architecture Documentation](docs/architecture/authentication.md)
- [Operations Runbook](docs/operations/auth0-runbook.md)
- [Auth0 Setup Guide](docs/user-authentication-plan/auth0-setup.md)

## Super-Admin & Client Onboarding

Platform operators (super-admins) can provision entirely new client tenants via the
`bootstrapNewClient` GraphQL mutation. Super-admin status is controlled through the `super_admins`
DB table — not through the app.

- [Super-Admin Runbook](docs/super-user/super-admin-runbook.md) — registering admins, bootstrapping
  tenants, security model
- [Super-Admin Plan](docs/super-user/plan.md) — roadmap for cross-tenant access and global client
  listing

## Testing

The test suite is organized into three projects for efficiency:

- **Unit tests** (`yarn test`): Fast, isolated tests with no external dependencies
- **Integration tests** (`yarn test:integration`): DB-backed tests requiring PostgreSQL and
  migrations
- **Demo seed E2E** (`yarn test:demo-seed`): Full seed-and-validate pipeline (slow, ~10-30s)

### Running Tests

```bash
# Fast unit tests only (default, no DB required)
yarn test

# Unit + integration tests (requires DB + migrations)
yarn test:integration

# Demo seed E2E (requires a local DB + migrations + ALLOW_DEMO_SEED=1)
ALLOW_DEMO_SEED=1 yarn test:demo-seed
```

### Prerequisites for Integration/Demo Tests

Integration and demo-seed tests require:

1. **PostgreSQL running**: Start with `docker compose -f docker/docker-compose.dev.yml up -d db`
2. **Migrations applied**: Run `yarn workspace @accounter-helper/migrations migration:run`
3. **Demo seed only**: Set `ALLOW_DEMO_SEED=1` for the command; without it the demo-seed test is
   skipped. The test resets the database it is pointed at, so it never sets the variable itself and
   refuses any database that is not local.

If migrations are stale, demo-seed tests fail gracefully with instructions to run migrations.

No vitest project collects anything under `.claude/`. Claude Code keeps git worktrees (complete
copies of the repo) in `.claude/worktrees/`, and their test files would otherwise run against this
checkout's database. The `unit` project only looks under `packages/` and `scripts/`, so a second
checkout elsewhere inside the repo folder contributes nothing either. One placed under `packages/`
or `scripts/` would still contribute its plain unit tests (never its database-backed ones), so keep
other checkouts out of those two. `scripts/__tests__/vitest-collection.test.ts` fails if any of this
stops being true.

See [`packages/server/README.md`](packages/server/README.md) for detailed test harness
documentation.

## Database safety

The root `.env` must only ever point at a local database. Keep the credentials of a deployed
database in a separately named file (for example `.env.production`, which is git-ignored) and pass
them to one command on purpose.

The tooling also checks its target, as a second line of defence. The checks are not uniform:

| Command                                                          | Against a non-local database                                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| DB-backed tests, the vitest global setup, `yarn seed:production` | Refused, unless `ALLOW_REMOTE_DB=1` is set for that one command.                                   |
| `yarn test:demo-seed`                                            | Refused. Nothing overrides it.                                                                     |
| `yarn seed:staging-demo`                                         | Refused, unless `ALLOW_REMOTE_DB=1` is set for that one command and it is a demo database (below). |
| `migration:run`                                                  | Warns and proceeds, because deploys run it. Refused with `ENFORCE_LOCAL_DB=1`.                     |
| `yarn generate`                                                  | Not checked. It only reads.                                                                        |

"Non-local" goes by the host `pg` would connect to: `POSTGRES_HOST`, or `PGHOST` when that is unset
or blank.

`yarn seed:staging-demo` truncates the domain tables before it inserts, so being allowed to reach a
host is not enough for it. It also decides by the name of the database it is about to reset
(`scripts/demo-seed-guard.ts`), on a local host as well as a remote one:

- A database whose name carries `prod`, `production`, `prd` or `live` is refused, and nothing
  overrides that.
- A database whose name carries `staging`, `stage`, `demo`, `test`, `testing`, `preview`, `sandbox`,
  `e2e` or `local` is accepted. That is how a staging deploy runs it, with
  `ALLOW_REMOTE_DB=1 ALLOW_DEMO_SEED=1` in its build command.
- On a local host, the dev container's own database, `accounter`, is accepted.
- Any other database has to be confirmed by name, for that one command:
  `ALLOW_DEMO_SEED_DATABASE=<exact database name>`. That includes a local copy of production under
  another name, and a name with `prod` glued to other letters (`preprod_staging`).

### `ENFORCE_LOCAL_DB=1`

Set this on every developer machine, in your shell profile so it also covers checkouts and git
worktrees that have no `.env` of their own:

```sh
echo 'export ENFORCE_LOCAL_DB=1' >> ~/.zshrc
```

With it, `migration:run`, the one command that otherwise only warns about a non-local database,
refuses it instead. Deploys leave it unset, which is why refusing is not the default. When you do
mean to run it against a deployed database, add `ALLOW_REMOTE_DB=1` to that one command.

`ALLOW_REMOTE_DB=1`, `ALLOW_DEMO_SEED=1` and `ALLOW_DEMO_SEED_DATABASE` are per-command opt-ins.
Never put them in a shell profile. In a `.env` file they are refused: tests and seeds stop with an
error until the line is removed.

## Miscellaneous

### Multiple Bank Branches

For Poalim Bank and Discount Bank accounts, your account may appear under multiple branch numbers:

- Your account number and bank number remain the same
- The same account might be associated with 2-3 different branch numbers
- You can configure all relevant branch numbers in the `scripts/seed.ts` file

### Enable Google Drive

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing one
3. Enable Google Drive API:
   - Navigate to "APIs & Services" > "Library"
   - Search for and enable "Google Drive API"
4. Create API key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Restrict the key to Google Drive API only
5. Add to `packages/server/.env`:
   ```
   GOOGLE_DRIVE_API_KEY=your_api_key_here
   ```

### Enable OCR (with Anthropic)

1. Sign up for an Anthropic API key at
   [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Add to `packages/server/.env` (read directly by the `@ai-sdk/anthropic` library):
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```
3. OCR functionality will now be available for processing images and documents
