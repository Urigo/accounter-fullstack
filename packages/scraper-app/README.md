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

Then open [http://localhost:4001](http://localhost:4001) in your browser.

> The default port is `4001`. Override it with the `PORT` environment variable (see below).

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

## Your vault file

All credentials and settings live in one encrypted **vault file** that you keep. The app never
writes it to disk: when you open it, the server decrypts it in memory for the session only.

When you open the app you choose one of two paths:

- **Open my vault**: pick (or drag in) your vault file, then unlock it with its master password.
- **Create a new vault**: choose a master password and enter your Accounter server URL and scraper
  API key. Then save the new vault file somewhere safe. You can skip that step, but the vault exists
  only in memory until you save it.

### Saving changes

Adding credentials, classifying accounts, changing settings, and running a scrape that discovers new
accounts all change the vault in memory. When the session has changes that your file does not, a
banner at the top of every screen counts them. Expand it to see what changed, and rows that changed
get a `New` / `Edited` tag in Config.

- **Save to <file>** overwrites the file you opened. This needs a Chromium-based browser (File
  System Access API). In other browsers the button reads **Download updated vault**: save the
  download over your old file, then click **I've replaced it** in the banner. The app can't tell
  whether a download was kept, so the changes count as unsaved until you confirm.
- **Download copy** saves a copy and leaves your original file untouched.

The browser warns you if you try to leave the page with unsaved changes. Stopping the server
discards any unsaved changes.

One vault is open at a time, shared by every browser tab. Opening another vault means closing the
current one first (**Close vault** in the header menu), and the vault can't be closed while a scrape
is running. Tabs keep each other up to date, so a change or save made in one shows in the others.

> Upgrading from an earlier version? Your existing `.vault` file (in the directory you ran the app
> from) still works. Open it from the welcome screen. `VAULT_PATH` is no longer used.

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

| Variable | Default | Description                             |
| -------- | ------- | --------------------------------------- |
| `PORT`   | `4001`  | HTTP port the Fastify server listens on |

## Run history

The **History** tab lists the runs from the current session. To keep history between sessions, turn
on **Save run history to a file** in **Config → Settings**. Runs are then appended to the history
file path set there (default `./history.json`), along with the runs already made this session. The
setting is off by default, and nothing is written while it is off.

## Vault backup

Your vault file is the only copy of your credentials. Keep a backup (**Download copy** in the vault
menu at the top right). If it is lost, you will need to re-enter every credential.
