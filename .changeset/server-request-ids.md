---
'@accounter/server': patch
---

One request id per request, validated (part of #4872).

- `requestIdOf(request)`: a valid `X-Request-Id`, else the OTel trace id, else a random UUID,
  memoized per request. The DB log lines use it.
- `X-Request-Id` and `X-Correlation-Id` are used only if they match `^[A-Za-z0-9._:-]{8,64}$`. A
  malformed correlation id is no longer set as the OTel span attribute.
- `X-Correlation-Id` is never used as the request id: the MCP server sends the same one on every
  call of a tool run, retries included.
