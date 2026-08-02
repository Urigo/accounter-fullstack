---
'@accounter/mcp-server': patch
---

- Extend GraphQL codegen document discovery to include MCP server tool source files and generate
  `typescript-operations` output for the MCP server.
- Update MCP tool handlers (`charges`, `lookups`, `reports`) to use generated `Mcp*Query` /
  `Mcp*QueryVariables` types instead of local `Raw*` interfaces.
- Ensure the new generated MCP output directory is cleared as part of `generate:graphql:clear`.
