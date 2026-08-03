---
'@accounter/mcp-server': patch
---

Enforce `MCP_TOOL_ALLOWLIST`. The parsed allowlist was previously never read, so
every registered tool was advertised and dispatchable regardless — harmless
while phase 1 is read-only, but a real control gap once mutating tools land.
`tools/list` now filters advertised tools through the allowlist and `tools/call`
rejects an excluded tool as `Unknown tool` (indistinguishable from a nonexistent
one, so the allowlist does not leak which capabilities exist). Semantics: an
empty allowlist imposes no restriction (every tool exposed); a non-empty
allowlist restricts to exactly the named tools. When narrowing, keep
`accounter_list_businesses` in the set — it is the discovery entry point for
business scoping.
