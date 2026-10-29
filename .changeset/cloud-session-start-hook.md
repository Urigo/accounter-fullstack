---
---

Add a SessionStart hook for Claude Code cloud sessions (`.claude/hooks/session-start.sh`). In a
cloud session it installs the Node version from `.node-version`, runs `yarn install`, starts Postgres
18 from `docker/docker-compose.dev.yml` (stopping the image's own Postgres 16 if it holds port 5432),
exports the `.env.template` database settings for the session, and runs migrations, `yarn generate`
and `yarn build:tools`, so lint, typecheck, codegen and DB-backed tests work out of the box. It does
nothing outside cloud sessions. Developer tooling only; no release.
