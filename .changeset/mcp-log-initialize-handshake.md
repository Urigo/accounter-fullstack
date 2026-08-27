---
'@accounter/mcp-server': patch
---

Log the MCP `initialize` handshake, so a client changing underneath this connector is visible.

The connector recently went blind — every tool returned its summary line and no rows — because rows
lived only in `structuredContent`, a field a client may ignore, and the client's handling of it
changed. Establishing that took a rollback test plus reading Claude Desktop's own log directory,
because this server records **nothing** about who connects: `initialize` never read `request.params`
and never logged. The one hop with no trace was the one that mattered.

Every `initialize` now emits one structured line tagged `event: "mcp_initialize"`, joining
`tool_call` as the second selectable event. It carries `clientName` / `clientVersion` (the fields
that date a client-side change), `requestedProtocolVersion` vs `servedProtocolVersion`, a
`protocolVersionMismatch` boolean, `clientCapabilities` (names only — the values are unbounded and
caller-supplied), and the usual `userId` / `correlationId` so a session can be joined across both
events.

Three decisions are load-bearing:

- **Logged from `dispatchMcpRequest`, not from the `case 'initialize'` that builds the response.**
  `handleRpcRequest` is the pure, env-free half and takes only the request — it has neither the
  caller nor the correlation id. Delegating to it afterwards keeps the response built in exactly one
  place, so the two cannot drift. The sync `handleMcpBody` path has no production call sites and
  stays silent, which leaves its existing test of the pure response shape untouched.
- **`describeInitializeParams` is total.** `params` is `unknown` off the wire and validated only as
  a non-null object *or array*, so every field is narrowed there and anything unexpected degrades to
  `null`/`[]`. A malformed handshake must still produce a line: a client sending something this
  server cannot parse is precisely the event worth seeing, and an exception there would lose it.
- **Caller-derived fields are spread beneath the canonical ones**, matching the `tool_call` line.
  Without that, `clientInfo` would be an authenticated way to attribute a call to a different
  `userId`. Client strings are also clipped before reaching the log.

Deliberately excluded: a `labeledTotals` counter keyed by client version. `/metrics` is
unauthenticated while calling a tool requires a token — already flagged as worth closing — and
client identity is a fingerprint of the deployment, so it belongs in the log (durable, access-
controlled by the platform) rather than on a public endpoint. Worth revisiting once `/metrics` is
gated.

Also deliberately excluded: protocol-version *negotiation*. The server keeps answering `2025-06-18`
unconditionally; this only records what was asked. Changing what the server advertises is a live
behavioral change to a connector that has just broken once, and it should be decided against a
logged mismatch rather than a guess — which is what `protocolVersionMismatch` now provides.
