---
'@accounter/mcp-server': patch
---

Detect and log requests from clients speaking a newer MCP protocol era.

This connector implements a handshake-based protocol revision. The current revision removed
`initialize` entirely — version, identity and capabilities now travel per-request in `_meta`. A
client that moved there completely would simply stop handshaking, which means the handshake logging
added earlier **cannot** warn us about it: `mcp_initialize` would go quiet rather than report a
changed version, and the first real symptom would be failing calls. That is the same shape as the
incident that prompted all of this, and worse — a legacy-only server answering a modern-only client
fails outright rather than returning partial results.

What makes it detectable in advance is that a dual-era client on Streamable HTTP tries a modern
request **first** and falls back based on the response. That attempt is the warning, and until now
nothing was looking for it.

Any request carrying one of these emits a single `event: "mcp_modern_probe"` line at `warn`, with
the method, the client identity it advertised, and the revision it named:

- `MCP-Protocol-Version` whose value disagrees with what we serve — a header this server has never
  read, which is half of a real conformance gap in our own revision (we observe it; we still do not
  enforce it, because enforcement changes behavior)
- a per-request `_meta` protocol version, client info, or capabilities
- the modern-only `server/discover` method

Deliberately quiet otherwise. `MCP-Protocol-Version` is required by the revision we already
implement, so it may well be on every call; recording its presence would make this event mean "a
request happened" rather than "something changed", and `mcp_initialize` already reports the
negotiated version.

**Observation only, and that is the load-bearing property.** Era detection keys off exactly what a
server returns: a dual-era client decides we are legacy from the shape of our reply. Answering
`server/discover`, or anything else that makes us look modern, would stop the fallback that is
currently keeping every client working — the failure this is meant to warn about, caused by the
warning. So `server/discover` still returns method-not-found, and a test asserts responses are
byte-identical whether or not a probe was detected.

`describeModernEraProbe` is pure and total in the same way as `describeInitializeParams`: everything
it reads is caller-supplied and unvalidated, and a probe this server cannot parse is precisely the
event worth seeing rather than throwing on.

Capability names copied out of caller input are bounded — each clipped, the set capped at 20 with a
trailing `+N more` so a truncated list is visibly truncated. Both how many keys a caller sends and
how long each one is are bounded only by the 1 MB body cap, so a verbatim copy into a log line was
caller-controlled amplification: a ~600KB payload produced a ~613KB log line, and now produces a
1.4KB one. The same fix applies to `describeInitializeParams`, which shipped with the identical
unbounded copy and is already released — this corrects both.

Runbook §3.2 documents the fields, the `jq` recipes, and — since the point of this is to be a trigger
— what to do when it fires.
