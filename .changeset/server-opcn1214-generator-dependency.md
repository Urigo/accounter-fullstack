---
'@accounter/server': patch
---

The server now depends on `@accounter/opcn1214-generator` (form 1214) and builds it with the other
workspace generators: in `server:build:prod`, the `yarn dev` watch, the vitest alias, the server CI
workflow and the email ingestion gateway Docker image. Nothing uses it yet.
