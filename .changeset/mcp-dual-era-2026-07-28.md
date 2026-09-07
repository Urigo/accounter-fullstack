---
'@accounter/mcp-server': patch
---

Serve both MCP protocol eras: add the modern `2026-07-28` path beside the existing handshake.

The detector added after the blind-connector incident fired. Production logs show clients probing
`server/discover` with `2026-07-28` and falling back to `initialize` within a second — five times
for five, from two client families (`claude-code/2.1.263`, `Anthropic/ClaudeAI/1.0.0`) across three
users. Nothing was broken; the fallback worked. But the spec's compatibility matrix is explicit that
a modern-only client against a legacy-only server **fails outright**, and we were relying on every
client continuing to offer a fallback it is under no obligation to keep.

The logs also showed something nobody had predicted: every handshake was *already* a version
mismatch, clients asking for `2025-11-25` and being served `2025-06-18`. Closing that intermediate
gap was considered and rejected — it is cosmetic, costs nothing observable, and leaves the actual
exposure untouched. Full evidence and reasoning in `docs/connector-gaps-and-decisions.md`.

**Era is chosen per request, exactly as the spec prescribes**: a request carrying modern per-request
`_meta` gets modern semantics; anything else, `initialize` included, gets legacy. The modern path
adds `server/discover`, per-request `_meta` validation, header/body agreement checks
(`MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` including the `=?base64?..?=` sentinel),
`resultType: "complete"`, `_meta.serverInfo`, and `CacheableResult` hints on `tools/list`.

**The legacy path is byte-for-byte unchanged, and that is the point.** A dual-era client decides
which era a server speaks from the shape of its replies, so a legacy answer that drifted even
slightly would stop the fallback every current client depends on. `dispatchMcpRequest` is untouched;
the era branch lives at the boundary above it. The two eras share `dispatchToolMethods` — extracted
verbatim — so they cannot answer the same tool call differently. Proven rather than asserted: a test
captures legacy `initialize` / `tools/list` / `ping` responses and diffs them against the same
responses built from `main`. 46,310 bytes, identical.

HTTP status is part of the contract rather than decoration. Modern framing failures return `400`
(`-32020` header mismatch, `-32021` missing client capability, `-32022` unsupported version, with the
`supported` list so a client can retry) and `404` for an unimplemented method — because a dual-era
client reads *the body of a 400* to decide whether a server is modern. Flattening those to `200`,
which is what the legacy path does with every error, would read as "not modern" and send the client
back to the handshake.

Most of `2026-07-28` needed no work here: it removed sessions, `ping`, `logging/setLevel`, SSE
resumability and server-initiated requests, and added subscriptions and MRTR — none of which this
server implements. It declares one capability, `tools`, and was already stateless. What remained was
metadata validation, discovery, and result shape.

Two smaller conformance fixes ride along: `DELETE /mcp` now answers `405` like `GET` already did, and
an unexpected `Origin` header is **logged, not rejected**. The spec says a server MUST reject an
invalid `Origin` with `403`, but this server has never read the header, so we do not yet know what
our clients send — blind-enforcing a `403` on a live connector is how you cause the outage you were
preventing. Observe first, enforce against evidence. Same two-step that produced this migration.
