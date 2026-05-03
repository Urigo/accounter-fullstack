# Scraper App

A local web app that scrapes Israeli bank accounts and uploads transactions to your Accounter
server.

## Prerequisites

- **Node.js** v22 or later
- A running [Accounter](../../README.md) server with a scraper API key configured
- Yarn Berry (v4) — the repo uses Yarn workspaces

## How to start

### Development mode

Run the Fastify server (serves the UI and handles scraping):

```bash
yarn workspace @accounter-helper/scraper-app dev:server
```

Then open [http://localhost:3007](http://localhost:3007) in your browser.

> The default port is `3007`. Override it with the `PORT` environment variable (see below).

### Build for production

```bash
yarn workspace @accounter-helper/scraper-app build
```

This produces:

- `dist/` — compiled Fastify server (run with `node dist/index.js`)
- `dist/ui/` — compiled React SPA (served statically by the server)

To run the production build:

```bash
node packages/scraper-app/dist/index.js
```

## First-run vault setup

1. Open the app in your browser. You will see the **Vault Setup** wizard.
2. **Step 1 — Choose password**: Enter and confirm a master password. This encrypts all stored
   credentials.
3. **Step 2 — Server connection**: Enter your Accounter server URL (e.g.
   `http://localhost:4000/graphql`) and your scraper API key.
4. **Step 3 — Confirm**: Review and click **Create vault**. The vault is saved locally as an
   encrypted file.
5. You will be taken to the main app. Navigate to **Config → Credentials** to add bank sources.

On subsequent visits, you will be prompted to unlock the vault with your master password.

## Adding bank sources

1. Go to **Config → Credentials**.
2. Select a source type from the dropdown and click **Add source**.
3. Fill in the credentials form for your bank (username/password, OTP seed, etc.).
4. Click **Save**. The source appears in the list.

## Running a scrape

1. Go to the **Run** tab.
2. Select the sources you want to scrape (all are selected by default).
3. Set the date range — either "Last N months" or a custom from/to range.
4. Click **Run**. The scraper runs in the background; task rows show live status.
5. If a Poalim account requires an OTP, a dialog will appear — enter the code and submit.
6. When the run completes, a summary shows total new / skipped transactions.

## Environment variables

| Variable     | Default  | Description                             |
| ------------ | -------- | --------------------------------------- |
| `PORT`       | `3007`   | HTTP port the Fastify server listens on |
| `VAULT_PATH` | `.vault` | Path to the encrypted vault file        |

Example:

```bash
PORT=8080 VAULT_PATH=/data/my.vault node dist/index.js
```

## Vault backup

The vault file (default: `.vault` in the working directory) contains all encrypted credentials.
**Back up this file** — if lost, you will need to re-enter all credentials.

The vault file path is also shown in **Config → Settings** with a one-click copy button.
