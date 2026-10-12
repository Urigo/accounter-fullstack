---
'@accounter/mcp-server': patch
---

Document how Cursor connects to the Accounter MCP server. MCP clients other than Claude could not
log in, because the Auth0 application behind the connector only allows Claude's callback URL.

The new guide, `docs/connecting-clients.md`, sets the policy of one pre-registered Auth0 application
per MCP client family, with exact callback URLs, since Auth0 does not accept wildcard ports. It
covers the operator setup of a dedicated Cursor application (callbacks, grants, connections and the
user-access grant on the Accounter API), the `mcp.json` configuration for Cursor users,
verification, troubleshooting from the Auth0 logs, and rollback. The spec, local-development guide,
connector gaps and README now point to it.
