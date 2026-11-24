---
---

Database guardrails for Claude Code sessions in this repo (`.claude/settings.json`). Tooling and
docs only; no release.

- `ENFORCE_LOCAL_DB=1` is set in every session's environment, so `migration:run` refuses a non-local
  database there instead of warning.
- Env files cannot be read or edited: any `.env*` or `.dev.vars*` file in the session's own folder
  except the templates, and the usual names anywhere else on the machine, which is where a session
  in a git worktree finds the main checkout's `.env`.
- A command that sets `ALLOW_REMOTE_DB`, `ALLOW_DEMO_SEED` or `ALLOW_DEMO_SEED_DATABASE` waits for a
  person to confirm it (`.claude/hooks/ask-before-db-opt-in.mjs`), whichever tool runs it: Bash,
  PowerShell, Monitor or the desktop app's terminal. Where nobody can be asked, it is refused.
