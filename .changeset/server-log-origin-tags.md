---
'@accounter/server': patch
---

Server log lines now say where they came from: `module` (the `src/modules/<dir>`, or the top-level
`src` directory; `startup` for `index.ts`; `db` and `shutdown` for the infra scopes) and `component`
(the file name), from a new `getLogger(import.meta.url)`, plus `service`, `env` and `release` on
every line. `release` comes from a new, optional `RELEASE` env var, else Render's
`RENDER_GIT_COMMIT`. The files that already use the structured logger adopt it; `console.*` call
sites are unchanged.

New `SERVER_LOG_LEVEL_OVERRIDES` (e.g. `deel=debug,db=warn`) sets a level per module, and
`SERVER_LOG_LEVEL` accepts `silent` (`fatal` is still always written).
