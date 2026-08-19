---
'@accounter/mcp-server': patch
---

Log every tool call as one structured `event: "tool_call"` line, with glossary lookups enriched.

`accounter_explain_terminology` is a read of caller *intent*: what someone asks the glossary is the
clearest available signal of the vocabulary they arrived with and what they were trying to do before
they knew how to ask for data. None of it was being recorded. Nor was anything else about a tool
call — `executeRegisteredTool` fed the in-memory metrics registry and returned, so a successful
`tools/call` produced no log line at all, and the per-request logs in `server.ts` cannot fill the gap
because every MCP call is the same `POST /mcp`. This also closes a documented gap: `docs/spec.md`
§11.1 asks for per-request logs carrying `user_id`, `business_scope`, `tool_name`, outcome and
`latency_ms`, none of which were logged.

Every completed call now emits exactly one line tagged `event: "tool_call"` — on every path,
including the validation, authorization and rate-limit rejections that never reach a handler —
carrying `tool`, `outcome` (the same label set as the `requestsTotal` metric), `latencyMs`, `userId`,
`correlationId`, `businessScopeSize`, and, for anything built with the shared list shaping,
`returnedCount`/`totalCount`/`truncated`. `event` is a stable discriminator so the stream can be
selected on without matching free-text messages.

A tool enriches its own line through a new optional `observe(input, result)` hook on
`ToolDefinition`. It is deliberately not a field on `ToolResult`: `tools/call` returns that object
verbatim as the JSON-RPC payload, so telemetry attached there would be sent to every caller. The
hook is pure, guarded against throwing (a broken hook must not turn a successful call into an error),
and its fields are merged *beneath* the canonical ones — a tool cannot misreport its own name,
outcome, or caller.

The glossary implements it with `glossaryMode`, `requestedTerms` (verbatim, so an alias the caller
reached for stays visible), `matchedTerms` (canonical), `missedTerms` and `requestedTopics`, plus
three label counters — `glossary_term_requests`, `glossary_term_misses` and `glossary_mode` — exposed
under a new `labeledTotals` key on `GET /metrics`, so "most-requested term" and "terms we do not
define yet" are one `curl` away and do not require parsing logs. Two decisions there are load-bearing:

- **Matches are resolved from the input, not read back off the result.** A call carrying
  `topics: ["charge"]` returns every charge entry, and none of those was individually asked for;
  counting them would turn "most-requested term" into a measure of topic breadth. Index mode, which
  returns all 62 entries, credits no individual term at all for the same reason.
- **Label cardinality is capped.** Miss labels derive from caller input, so they are folded (one
  concept, one label, regardless of spelling), clipped to 40 characters, and bounded at
  `MAX_COUNTER_LABELS` distinct labels per counter with further new labels folded into `__other__`.
  Labels already tracked keep counting, so the top-N stays accurate once the cap is reached. Worth
  knowing: `/metrics` is unauthenticated while calling a tool requires a valid token, so miss labels
  are authenticated-write and publicly readable — bounded to junk vocabulary by the folding and the
  caps, and the glossary tool is classified `public` with no customer data, but a reason to gate
  `/metrics` eventually.

Guarded by a registry-wide test in the style of `scope-forwarding.test.ts`: it iterates the
production registry and asserts every registered tool emits exactly one canonical `tool_call` line,
so a tool added later cannot silently ship without usage logging.
