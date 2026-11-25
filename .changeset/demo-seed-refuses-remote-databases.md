---
'@accounter/server': patch
---

The demo seed refuses to run against a non-local host unless `ALLOW_REMOTE_DB=1` is set. The
demo-seed E2E test no longer grants itself `ALLOW_DEMO_SEED=1`, and the vitest global setup checks
the database host after loading `.env` rather than before. A `.env` pointing at a remote host now
aborts every vitest run, `--project unit` included.

The non-local database guard also:

- resolves a blank or unset `POSTGRES_HOST` through `PGHOST`, as `pg` does, instead of treating it
  as local
- refuses to run tests or seeds when `ALLOW_REMOTE_DB` or `ALLOW_DEMO_SEED` is set in a `.env` file;
  both are per-command opt-ins

The demo-seed E2E strips `ALLOW_REMOTE_DB` from the seed's environment, so it can never reach a
remote database, and in CI it fails instead of being skipped when `ALLOW_DEMO_SEED` is missing.
