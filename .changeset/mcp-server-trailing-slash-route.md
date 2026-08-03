---
'@accounter/mcp-server': patch
---

Tolerate a trailing slash on the MCP transport route. Previously only the exact
path `/mcp` was routed, so `POST /mcp/` — a correct-looking URL — fell through
to a `404` that was raised before the auth layer, so `/metrics` recorded nothing
and the failure looked like an outage rather than a typo. Route lookup now
normalizes the request path (stripping a trailing slash, preserving the root
`/`), so `/mcp/` reaches the same handler, auth layer, and metrics as `/mcp`.
`context.route` still carries the raw pathname for logging fidelity.
