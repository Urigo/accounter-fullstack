# Accounter — neoccounter workspace

A self-hosted financial accounting platform for Israeli businesses. It scrapes bank and credit-card
transactions, stores them in PostgreSQL, and exposes a GraphQL API consumed by a React dashboard.

## What this repo is

This is a private fork of [Urigo/accounter-fullstack](https://github.com/Urigo/accounter-fullstack)
maintained at `github.com:robotaitai/accounter-fullstack` on the branch `feat/settings-page`.

Key additions on top of upstream:

- **Multi-tenant Auth0 setup** — JWT authentication, role-based access (owner / accountant /
  employee / viewer / scraper), email-invitation flow with automatic Auth0 user creation.
- **scraper-local-app** — standalone Node.js scraper that runs locally (or on a schedule) and
  pushes data from Isracard, Mizrahi, and Priority ERP into Postgres via custom triggers.
- **Priority ERP integration** — GraphQL module to sync invoices from the Priority OData API.
- **Dashboard enhancements** — per-source data counts, data types, date ranges, and 26-month bar
  charts.

## Architecture overview

```
Browser (React/Vite :3001)
  |-- GraphQL (graphql-yoga :4000)
       |-- PostgreSQL :5432  (main DB, Row Level Security per tenant)
       |-- Auth0              (authentication + user management)
       |-- Priority OData API (invoice sync)

scraper-local-app (Node.js, runs on demand or via cron)
  |-- Isracard (puppeteer-extra stealth)
  |-- Mizrahi  (puppeteer-extra stealth)
  |-- Priority (OData HTTP)
  |-- PostgreSQL :5432
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, urql (GraphQL client) |
| Backend | Node.js 24, graphql-yoga, GraphQL Modules, pgtyped |
| Database | PostgreSQL 16, Row Level Security, custom triggers |
| Auth | Auth0 (Universal Login, RS256 JWT) |
| Scrapers | israeli-bank-scrapers, puppeteer-extra, puppeteer-extra-plugin-stealth |
| Monorepo | Yarn 4 workspaces |
| Tests | Vitest (unit + integration) |

---

## Prerequisites

Install these before anything else:

- **Node.js 24** via [nvm](https://github.com/nvm-sh/nvm)
- **Docker** (for the local PostgreSQL container)
- **Yarn 4** (comes bundled — no separate install needed)
- **Git**
- **Chromium** dependencies (for Puppeteer scrapers — on macOS this is automatic)

---

## Installation

### 1. Clone the repo

```sh
git clone git@github.com:robotaitai/accounter-fullstack.git
cd accounter-fullstack
git checkout feat/settings-page
```

### 2. Use the correct Node version

```sh
nvm install 24
nvm use 24
```

### 3. Install dependencies

```sh
node .yarn/releases/yarn-4.13.0.cjs install
# or simply (if you have the Yarn 4 corepack shim active):
yarn install
```

### 4. Set up environment variables

```sh
cp .env.template .env
```

Then fill in the values in `.env`. The sections below explain each group.

### 5. Start the database

```sh
docker compose -f docker/docker-compose.dev.yml up -d
```

This starts a PostgreSQL 16 container on port 5432. Data is persisted in
`docker/.accounter-dev/postgresql/db`.

### 6. Run migrations

```sh
node .yarn/releases/yarn-4.13.0.cjs db:migrate
```

This applies all schema migrations (including our custom scraper triggers).

### 7. Build the project

```sh
node .yarn/releases/yarn-4.13.0.cjs build
```

### 8. Run the app

Open three terminals:

```sh
# Terminal 1 — GraphQL server
node .yarn/releases/yarn-4.13.0.cjs workspace @accounter/server dev

# Terminal 2 — React frontend
node .yarn/releases/yarn-4.13.0.cjs workspace @accounter/client dev

# Terminal 3 — (optional) GraphQL code generation watcher
node .yarn/releases/yarn-4.13.0.cjs generate:watch
```

Visit **http://localhost:3001** — you will be redirected to Auth0 login.

---

## Environment variables reference

### Database

```ini
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=accounter
POSTGRES_SSL=0
```

### Auth0 (required)

You need two Auth0 applications: an **SPA** for the frontend and an **M2M** app for user management.

```ini
# JWT verification
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.accounter.com

# SPA app (shown in the browser login screen)
AUTH0_FRONTEND_CLIENT_ID=your_spa_client_id

# M2M app (server-to-server: create users, send invitations)
AUTH0_CLIENT_ID=your_m2m_client_id
AUTH0_CLIENT_SECRET=your_m2m_client_secret
AUTH0_MANAGEMENT_AUDIENCE=https://your-tenant.us.auth0.com/api/v2/
```

See **Auth0 setup** section below for how to create these applications.

### Encryption

```ini
SETTINGS_ENCRYPTION_KEY=64_char_hex_string   # generate: openssl rand -hex 32
```

Used to encrypt sensitive source credentials stored in the database.

### Scraper credentials (add only what you use)

```ini
# Isracard
ISRACARD_ID=your_id
ISRACARD_PASSWORD=your_password
ISRACARD_6_DIGITS=last_6_digits_of_id

# Mizrahi
MIZRAHI_USERNAME=your_username
MIZRAHI_PASSWORD=your_password

# Priority ERP (stored encrypted in DB via the Sources UI — no .env entry needed)
```

### Optional integrations

```ini
ANTHROPIC_API_KEY=...   # OCR on documents
GREEN_INVOICE_ID=...    # Invoice issuing
CLOUDINARY_NAME=...     # File uploads
GOOGLE_DRIVE_API_KEY=...
```

---

## Auth0 setup

### SPA application

1. Auth0 Dashboard → Applications → Create Application → Single Page Web Applications
2. Name it `Accounter Dashboard`
3. Under **Application URIs**:
   - **Allowed Callback URLs**: `http://localhost:3001/callback`
   - **Allowed Logout URLs**: `http://localhost:3001`
   - **Allowed Web Origins**: `http://localhost:3001`
4. Copy the **Client ID** → `AUTH0_FRONTEND_CLIENT_ID` in `.env`
5. Under **Advanced → Grant Types**: enable `Implicit`, `Authorization Code`, `Refresh Token`

### API (audience)

1. Auth0 Dashboard → Applications → APIs → Create API
2. Name: `AccounterAPI`, Identifier: `https://api.accounter.com`
3. Copy the identifier → `AUTH0_AUDIENCE` in `.env`

### M2M application

1. Auth0 Dashboard → Applications → Create Application → Machine to Machine
2. Name it `Accounter Server`, authorize it against the Auth0 Management API
3. Grant scopes: `read:users`, `create:users`, `update:users`, `delete:users`
4. Copy **Client ID** and **Client Secret** → `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` in `.env`

### First login

On first login the setup wizard runs. Enter your company name to create the initial workspace.
Subsequent users are invited via **Settings → Team**.

---

## Inviting team members

1. Log in as the workspace owner.
2. Go to **Settings → Team → Add member**, enter their email, click **Send Invite**.
3. Copy the generated invitation link from the green box.
4. Send the link to the invitee.
5. Invitee visits the link → clicks **Accept Invitation** (no login required at this step — their
   Auth0 account is unblocked automatically).
6. They click **Log In** and set/use their password.

Roles available: `business_owner`, `accountant`, `employee`, `viewer`.

---

## Running the scrapers

The `scraper-local-app` package fetches transactions and upserts them into Postgres. It can be
triggered from the **Sources & Sync** dashboard or run directly.

### From the dashboard

In the app, go to **Sources & Sync** and click the **Refresh** button next to a source.

### From the command line

```sh
export POSTGRES_HOST=localhost
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_DB=accounter

# Run all configured scrapers
node .yarn/releases/yarn-4.13.0.cjs workspace @accounter/scraper-local-app scrape

# Run only specific scrapers
SCRAPE_PROVIDERS=isracard-alt,mizrahi \
ISRACARD_ID=... ISRACARD_PASSWORD=... ISRACARD_6_DIGITS=... \
MIZRAHI_USERNAME=... MIZRAHI_PASSWORD=... \
  node .yarn/releases/yarn-4.13.0.cjs workspace @accounter/scraper-local-app scrape
```

**Note:** The scrapers use `puppeteer-extra` with stealth mode to bypass bot detection. They run
headlessly by default. If a scraper fails with a `TIMEOUT` error, the bank's login page may have
changed — test with `showBrowser: true` in the relevant scraper file.

### Scraper data flow

```
Bank API / Website
  --> bank_mizrahi_transactions  (or isracard_alt_transactions)
       |-- PostgreSQL trigger fires on INSERT
            --> transactions_raw_list  (deduplication)
            --> charges                (one per transaction)
            --> transactions           (linked to financial_accounts via account_number)
```

The trigger only creates a `transactions` row when the account number matches a record in
`financial_accounts`. Make sure the relevant financial account is registered in the system.

---

## Priority ERP sync

Priority credentials are stored encrypted in the database (not in `.env`).

1. Go to **Sources & Sync** in the dashboard.
2. Click **Add Source** → select **Priority**.
3. Enter the OData URL, company code, API key, and PAT token.
4. Click **Refresh** to run the first sync.

---

## Testing

```sh
# Fast unit tests (no DB required)
node .yarn/releases/yarn-4.13.0.cjs test

# Unit + integration tests (requires running Postgres + migrations)
node .yarn/releases/yarn-4.13.0.cjs test:integration

# Run a specific test file
node .yarn/releases/yarn-4.13.0.cjs vitest run path/to/test.ts
```

Integration tests use an isolated schema created on the fly and torn down after each run.

---

## GraphQL code generation

After changing any `.graphql` schema or query files, regenerate the TypeScript types:

```sh
node .yarn/releases/yarn-4.13.0.cjs generate
```

During active development, run the watcher instead:

```sh
node .yarn/releases/yarn-4.13.0.cjs generate:watch
```

---

## Project structure

```
packages/
  client/              React frontend (Vite)
  server/              GraphQL API (graphql-yoga)
    src/modules/
      auth/            JWT validation, invitations, team management
      priority/        Priority ERP GraphQL module
      workspace-settings/  Dashboard stats, source sync trigger
  scraper-local-app/   Bank scrapers (runs standalone, not part of server)
    src/scrapers/
      isracard-alt/    Isracard credit card scraper
      mizrahi/         Mizrahi bank scraper
      priority/        Priority invoice scraper
    src/migrate.ts     Custom DB triggers for scraper tables
  migrations/          Postgres schema migrations
  modern-poalim-scraper/ Zod schemas for Israeli bank API responses
```

---

## Remote access (Cloudflare Tunnel)

To expose the local app to the internet without a static IP:

```sh
# Expose the GraphQL server
cloudflared tunnel --url http://localhost:4000 &

# Expose the frontend (pass the server tunnel URL as an env var)
VITE_GRAPHQL_URL=https://<server-tunnel>.trycloudflare.com/graphql \
  node .yarn/releases/yarn-4.13.0.cjs workspace @accounter/client dev --host &
```

After getting the frontend tunnel URL, add it to Auth0's **Allowed Callback URLs**,
**Allowed Logout URLs**, and **Allowed Web Origins** in the SPA application settings.

---

## Common issues

| Symptom | Fix |
|---|---|
| "Something went wrong" on Auth0 login | Add the app URL to Auth0 Allowed Callback/Logout/Web Origin URLs |
| "Failed to create user in identity provider" | M2M credentials stale — restart the server after updating `AUTH0_CLIENT_ID`/`AUTH0_CLIENT_SECRET` |
| Scraper returns 0 new transactions | All fetched rows already exist in the DB — this is normal after the first sync |
| Scraper `TIMEOUT` at login | Bank changed their login page; test with `showBrowser: true` |
| `null value in column "current_balance"` | Run `yarn db:migrate` to apply the latest trigger fixes |
| Dashboard shows "GraphQL API Unreachable" | Server is not running on port 4000, or `VITE_GRAPHQL_URL` points to a wrong URL |

---

## Authentication

For more detail on the Auth0 setup and operations:

- [Architecture Documentation](docs/architecture/authentication.md)
- [Operations Runbook](docs/operations/auth0-runbook.md)
