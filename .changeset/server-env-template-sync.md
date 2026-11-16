---
'@accounter/server': patch
---

`ALLOW_DEV_AUTH` is now validated at startup: it must be `1` or `0` (or unset), and any other value
stops the server with an error instead of silently leaving the dev-auth bypass off. The unused
`EMAIL_INGESTION_V2_ENABLED` / `EMAIL_INGESTION_SHADOW_MODE` server settings are gone (the
email-ingestion gateway reads its own). `packages/server/.env.template` now lists every variable the
server reads, and a unit test keeps it in sync with the schema.
