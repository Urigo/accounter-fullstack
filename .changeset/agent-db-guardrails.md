---
---

Database guardrails for Claude Code sessions in this repo (`.claude/settings.json`). Tooling and
docs only; no release.

- `ENFORCE_LOCAL_DB=1` is set in every session's environment, so `migration:run` refuses a non-local
  database there instead of warning.
- `.env` files cannot be read, as they already could not be edited. The templates can.
- A command that sets `ALLOW_REMOTE_DB`, `ALLOW_DEMO_SEED` or `ALLOW_DEMO_SEED_DATABASE` waits for a
  person to confirm it (`.claude/hooks/ask-before-db-opt-in.mjs`).
