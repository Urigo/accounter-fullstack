---
'@accounter/mcp-server': patch
---

When a list result is cut to fit the response size, the `continuation` hint now says how many of the
fetched rows were dropped (`droppedCount`) and that they are not on the next page. The old hint
suggested requesting the next page, which silently skipped those rows.
