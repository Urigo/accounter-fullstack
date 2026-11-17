---
'@accounter/mcp-server': patch
---

Adds `packages/mcp-server/.env.template` documenting every environment variable the MCP server
reads, with a test that keeps it and the README configuration table in sync with the schema. The
README no longer describes an empty `MCP_TOOL_ALLOWLIST` as least privilege (it exposes every tool),
and the `MCP_PUBLIC_BASE_URL` validation message no longer misspells the variable.

`OTEL_DEPLOYMENT_ENV` now falls back to a `NODE_ENV` set in `.env`, not only one set in the shell:
the default used to be read when the module loaded, before `.env` was.
