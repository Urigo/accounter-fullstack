---
'@accounter/mcp-server': minor
---

Local dev-auth mode: with `MCP_LOCAL_DEV_AUTH_USER_ID` set, every `/mcp` request is served as that
business user without a token check, and upstream calls carry `X-Dev-Auth` instead of a bearer
token. Off by default; refused at startup unless `GRAPHQL_UPSTREAM_URL` and `MCP_PUBLIC_BASE_URL`
are on a loopback host and `NODE_ENV` is not `production`. The server then listens on 127.0.0.1
only and logs a warning and a banner at startup.
