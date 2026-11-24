---
---

DB-backed tests bring their own database. Test tooling and docs only; no release.

- The test harness always connects to `accounter_test`, on the server `POSTGRES_HOST` and
  `POSTGRES_PORT` name. It no longer uses the database `POSTGRES_DB` names, which with a `.env`
  copied from the template was the dev database.
- The vitest global setup creates that database when a local server does not have it yet, brings it
  to the latest migration, and then writes the countries reference data. It never creates a database
  on a server that is not local.
- The demo seed test seeds and resets `accounter_test` as well, so it can no longer empty dev data.
- Nothing changes in CI, whose Postgres service already starts with a database of that name.
