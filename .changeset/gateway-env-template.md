---
'@accounter/email-ingestion-gateway': patch
---

Adds `.env.template` for the gateway service and completes `.dev.vars.example` for the Cloudflare
Worker (adds `HEALTH_PROBE_TIMEOUT_MS`), with a test that keeps both, and the README tables, in sync
with the code. `wrangler.jsonc` now sets `keep_vars: false`: every Worker value is a secret, so the
config file is the source of truth and a dashboard plain-text var is removed on the next deploy.
