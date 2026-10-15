---
'@accounter/server': minor
---

**Breaking API change:** remove the deprecated `name` and `isClient` arguments from
`Query.allBusinesses`. Pass them as `filters.name` and `filters.isClient` instead. The client and
the MCP server already do.
