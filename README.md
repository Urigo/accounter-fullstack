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

3. Create `.env` file:

```sh
cp .env.template .env
```

4. Run setup:

If you want to create new local database, run:

```sh
yarn local:setup
```

In case you already have a database, you can set the database variables in your `.env` file, then
run:

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
   Configure Auth0 variables in `.env` (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`,
   `AUTH0_CLIENT_SECRET`, `AUTH0_MANAGEMENT_AUDIENCE`) before running the app.

7. Seed the database with your business details. Edit `scripts/seed.ts` with your info, then run
   `yarn seed`.

8. Load your data into the database (first set correct env vars):

```sh
yarn scrape
```

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

# Demo seed E2E (requires DB + migrations + ALLOW_DEMO_SEED=1)
ALLOW_DEMO_SEED=1 yarn test:demo-seed
```

### Prerequisites for Integration/Demo Tests

Integration and demo-seed tests require:

1. **PostgreSQL running**: Start with `docker compose -f docker/docker-compose.dev.yml up -d db`
2. **Migrations applied**: Run `yarn workspace @accounter/migrations migration:run`
3. **Demo seed only**: Set `ALLOW_DEMO_SEED=1` environment variable

If migrations are stale, demo-seed tests fail gracefully with instructions to run migrations.

See [`packages/server/README.md`](packages/server/README.md) for detailed test harness
documentation.

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
5. Add to your `.env`:
   ```
   GOOGLE_DRIVE_API_KEY=your_api_key_here
   ```

### Enable OCR (with Anthropic)

1. Sign up for an Anthropic API key at
   [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Add to your `.env`:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```
3. OCR functionality will now be available for processing images and documents
