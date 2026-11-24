---
---

The demo staging guide's troubleshooting section pointed at `grep '^POSTGRES' .env`, which also
prints `POSTGRES_PASSWORD`. It now gives the command that leaves the password out, like the rest of
the guide and the database guard's own messages. Docs only; no release.
