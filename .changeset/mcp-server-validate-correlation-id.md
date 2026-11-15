---
'@accounter/mcp-server': patch
---

An inbound `X-Correlation-Id` is now inherited only when it matches the server's id rule
(`^[A-Za-z0-9._:-]{8,64}$`); anything else is replaced by a generated id. This keeps arbitrary text
off MCP log lines and spans, and keeps one tool run's MCP and server logs on the same correlation id.
