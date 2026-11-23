---
'@accounter/server': patch
---

The demo seed refuses to run against a non-local host unless `ALLOW_REMOTE_DB=1` is set. The
demo-seed E2E test no longer grants itself `ALLOW_DEMO_SEED=1`, and the vitest global setup checks
the database host after loading `.env` rather than before.
