# Client end-to-end tests

Playwright tests that drive a production build of the client against the real server and a real
Postgres, from the database all the way to the UI.

Each run:

1. drops and recreates the e2e database (`accounter_e2e` by default), migrates it to the latest
   migration and seeds it (`seed-database.ts`, data in `data.ts`);
2. starts the server (`packages/server/dist`) against it, with dev auth (`ALLOW_DEV_AUTH=1`);
3. builds the client into `dist-e2e` with `VITE_DEV_AUTH_USER_ID` set to the seeded user, and serves
   it with `vite preview`;
4. runs `*.e2e.ts` in Chromium.

Nothing reads the root `.env` (which may point at production): the database comes from `E2E_*`
variables or local defaults, it must be local (`assertLocalDatabase`, with `ALLOW_REMOTE_DB` not
honoured), and its name must end in `_e2e`, since the seed drops it.

## Running locally

Prerequisites: a local Postgres (by default `localhost:5434`, user and password `postgres`), and the
Chromium Playwright uses (`yarn workspace @accounter/client playwright install chromium`).

Generate and build once, and again after changing the server (any migrated local database works for
codegen; never the root `.env` one):

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5434 POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres POSTGRES_DB=accounter_test POSTGRES_SSL=0 yarn generate
```

```bash
yarn build:tools && yarn workspace @accounter/server build
```

Then run the suite:

```bash
yarn workspace @accounter/client e2e
```

Ports 4000 (server) and 4183 (client) must be free: neither server is reused, so a dev server
pointed at another database can't be picked up by mistake.

Useful while iterating:

- `E2E_SKIP_CLIENT_BUILD=1` serves the last `dist-e2e` build instead of building again (rebuild
  after changing the client).
- `yarn workspace @accounter/client e2e -g "back and forward"` runs matching tests; `--headed` or
  `--ui` shows the browser.
- `E2E_POSTGRES_HOST`, `E2E_POSTGRES_PORT`, `E2E_POSTGRES_USER`, `E2E_POSTGRES_PASSWORD`,
  `E2E_POSTGRES_DB` point at another local database; `E2E_CLIENT_PORT` moves the client.

## Writing tests

- Name the rows a test expects through `data.ts` (`pageOf(ACME, 1)`), and wait for them with
  `expectCharges`.
- Count requests with `trackAllCharges`, and call `settle` before asserting a request was _not_
  sent.
- The database is seeded once per run. A test that writes must only touch its own data (as the merge
  test does with the `MERGEABLE` group).
- `startHoldingProxy` holds a deferred (`@defer`) response after its first part, for tests that
  depend on what the user does while it streams.
