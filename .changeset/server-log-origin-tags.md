---
'@accounter/server': patch
---

Server log lines now say where they came from: `module` (the `src/modules/<dir>`, or the top-level
`src` directory; `startup` for `index.ts`) and `component` (the file name), from a new
`getLogger(import.meta.url)`, plus `service`, `env` and `release` on every line. `release` comes
from a new, optional `RELEASE` env var. The files that already use the structured logger adopt it;
`console.*` call sites are unchanged.
