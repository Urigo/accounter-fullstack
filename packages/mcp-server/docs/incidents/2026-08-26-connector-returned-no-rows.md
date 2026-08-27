# Incident: the MCP connector returned counts without rows

|                   |                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------- |
| **Date reported** | 2026-08-26                                                                          |
| **Window**        | Between 2026-08-18 and 2026-08-26 (upper bound 8 days)                              |
| **Status**        | Resolved — fix verified end-to-end; #4295, #4299, #4302 and #4306 merged 2026-08-27 |
| **Severity**      | High — the connector was unusable for its primary purpose                           |
| **Data loss**     | None. No incorrect data was served; no security impact                              |
| **Trigger**       | External: a change in how the MCP client surfaces tool results                      |

---

## Summary

Every tool in the Accounter MCP connector stopped delivering data to the model. Calls still
succeeded, and still returned their human-readable summary line —
`Found 7 charge(s) across 2 businesses; showing 7 on page 1 of 1.` — but the rows behind that
sentence never reached the model. No ids, no dates, no amounts, no business names, from any of the
seventeen tools.

Nothing in this repository changed. The row data had lived in `structuredContent` since the
package's first commit, a field an MCP client is not obliged to surface, and the client stopped
surfacing it.

The fix moves every payload into `content`, the one channel a model is guaranteed to read.

## Impact

- **All seventeen tools affected.** The failure was in shared output shaping, not in any one tool.
- **Read tools were unusable for any data question.** A model could learn that seven charges matched
  and nothing else about them — not enough to answer, summarize, chart, or drill into.
- **Write outcomes were invisible.** `shapeWriteResult` had the same shape, so `updatedCount`,
  uploaded/failed counts and changed-record echoes never reached the model either. A write would
  apply upstream while the model could not confirm what it had done. No duplicate write was
  observed, but a model retrying an action it could not verify is the obvious hazard, and nothing in
  the design prevented it.
- **Error details were invisible.** `VALIDATION_ERROR` carries field-level `issues`; those traveled
  in the same unread field. A rejected call told the model _that_ it was wrong but never _what_ to
  fix, so its natural next move was to retry the same shape.
- **The glossary returned nothing readable.** `accounter_explain_terminology` shipped its entire
  content — 62 entries — into the invisible field.

Degradation was silent and misleading rather than loud. Because the summary line still arrived and
still carried accurate counts, the failure presented as "my filters are wrong", and the model
responded by trying different filters. A hard error would have been diagnosed in minutes.

## Timeline

| When               | What                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-31         | MCP server's first commit (`b82802376`). `shapeListResult` returns `content: [summary]` + `structuredContent: rows`. No tool declares an `outputSchema` — and none ever would.                                          |
| 2026-08-10 13:37   | A monthly-expenses chart is produced from `accounter_get_charges`, which requires actual amounts. Client logs show `Making remote MCP tool call` → `Remote tool call succeeded`. Working.                               |
| 2026-08-18         | A session finds charges by counterparty **and successfully applies a tag edit** — full data, successful write, on commit `e31e8066`. Last known-good moment.                                                            |
| 2026-08-18 → 08-26 | The client's remote-connector path changes. No corresponding change in this repository.                                                                                                                                 |
| 2026-08-26         | Reported: charge queries return counts with no rows. Reproduced across `search_charges`, `get_charges`, `get_documents`, `list_business_memberships`, `list_businesses`.                                                |
| 2026-08-26         | Root cause identified from the code, then confirmed empirically by dumping a real tool result. Fix implemented and verified end-to-end in the client ([#4295](https://github.com/Urigo/accounter-fullstack/pull/4295)). |
| 2026-08-27         | Rollback test: commit `e31e8066` — the exact code that worked on Aug 18 — checked out and run again, and it **reproduces the failure**. Server held constant, outcome flipped. Client confirmed as the variable.        |
| 2026-08-27         | Handshake logging added so the next such change is visible from this side ([#4299](https://github.com/Urigo/accounter-fullstack/pull/4299)). Both fixes merged the same day.                                            |

## Root cause

Every list-producing tool funnelled through one function, and that function put the rows somewhere
the model could not see:

```ts
// packages/mcp-server/src/tools/output.ts — unchanged since 2026-07-31
export function shapeListResult<T>(params: ShapeListParams<T>): ToolResult {
  // …
  return {
    content: [{ type: 'text', text: summarize(shown, total, truncated) }],
    structuredContent: structured // ← the rows lived only here
  }
}
```

Under MCP revision `2025-06-18`, `structuredContent` is contractually meaningful only when a tool
advertises an `outputSchema`. **No tool in this package has ever declared one** — the field appears
nowhere in the codebase's history. The specification correspondingly directs a server returning
structured content to _also_ return it serialized in a `TextContent` block, precisely so that a
client which ignores the structured channel still receives the data. This server did neither.

The connector was therefore depending on undefined-by-specification client behavior for its entire
payload. That dependency held for as long as the client happened to surface a `structuredContent`
with no schema behind it, and failed the moment it stopped.

### Establishing that it was the client

Three independent lines of evidence, in increasing order of strength:

1. **The server's code never changed.** `shapeListResult`'s return statement was byte-identical to
   its original. `output.ts` has been touched three times in its life, and the two edits inside the
   affected window were purely additive (`listShapeFields` for logging, `shapeWriteResult` for write
   tools). `executeRegisteredTool` and `dispatchMcpRequest` pass the result through untouched.
2. **Summary text could not have produced the earlier results.** Summary lines carry counts, never
   amounts. The Aug 10 monthly-expenses chart required real figures, so the rows demonstrably
   reached the model then.
3. **The rollback test.** Checking out `e31e8066` — the commit that worked on Aug 18, tag write
   included — and running it on Aug 27 reproduces the failure exactly. Same commit, same server,
   opposite outcome. This is conclusive: the only remaining variable is the client.

Client-side logs corroborate a re-plumbing rather than a tweak:

| Date       | Client log file     | Event vocabulary                                                                    | Outcome      |
| ---------- | ------------------- | ----------------------------------------------------------------------------------- | ------------ |
| 2026-08-10 | `main.log`          | `Making remote MCP tool call: accounter_get_charges` → `Remote tool call succeeded` | rows arrived |
| 2026-08-26 | `claude.ai-web.log` | `[MCP] tool_approval_gate {"toolName":"Accounter:accounter_search_charges",…}`      | rows missing |

Different log file, different subsystem, different event names. Four client updates land across the
period; since Aug 18 still worked, the change falls between `1.32352.1` and `1.37937.1`.

## What in our structure made this possible

The client's change was the trigger. These are the properties of our own design that turned a
third-party change into a total outage, and they are the parts worth fixing.

**1. The payload rode on an optional channel.** The distinction that mattered — `content` is
delivered, `structuredContent` is delivered _if the client feels like it_ — was never encoded
anywhere. Nothing in the code, the tests, or the docs recorded that the rows depended on a client
courtesy. A reader would reasonably assume both fields were equally load-bearing.

**2. The tests asserted the object, not the channel.** Every test read rows through
`result.structuredContent`. `content[0].text` was asserted only for summary strings. No test
anywhere checked that a row's id reached `content`. The consequence is stark: **the suite passed
760/760 both before and after the fix.** It was structurally incapable of detecting the outage,
because it verified that the server built the right object and never that the object would be
delivered.

**3. We had no record of the client.** `initialize` never read `request.params` and never logged, so
there was no trace of client name, client version, requested protocol revision, or declared
capabilities. Dating a client-side change required reading the _client's_ own local log directory on
a developer's machine. A production deployment would have had nothing at all.

**4. Failure degraded into a plausible wrong answer.** Counts still arrived and were correct. That
turned a transport fault into something that reads like a filtering problem, sending the model — and
then the operator — down the wrong path. Systems that half-work are harder to diagnose than systems
that stop.

**5. The insight existed but had not been acted on.** A comment in `charges.ts` already read: _"The
text content is what the model reads first, so surface a multi-business result there — otherwise a
union across businesses looks like a single-business answer until the model inspects `scope` in the
structured payload."_ Someone had recognized that `content` is the channel that reaches the model
and had moved one derived fact into it. The rows never followed.

**6. Nothing prevented recurrence per tool.** The shared shaper meant one fix repaired all seventeen
tools — a genuine strength. But nothing enforced that a _new_ tool would use it, so the same class
of bug could return one tool at a time.

## Detection

Detected by a user noticing that answers had become vague. No alert, no failing test, no error rate
change — every call returned HTTP 200 with a well-formed JSON-RPC result and an `outcome` of
`success`. Neither `/metrics` nor the `tool_call` usage log could have caught it: both recorded that
the server had _produced_ rows (`returnedCount: 7`), which was true. Nothing measured whether those
rows were delivered in a form the recipient reads.

Upper bound on the undetected window is 8 days.

## Resolution

### [#4295](https://github.com/Urigo/accounter-fullstack/pull/4295) — mirror every payload into `content`

A single `mirroredResult(summary, structured)` in `src/tools/output.ts`, which `shapeListResult`,
`shapeWriteResult` and `toToolErrorResult` all return through. The summary still leads; the
serialized payload follows in a second text block; `structuredContent` is retained for clients that
consume it directly. This is the backwards-compatibility behavior the specification asks for, and it
is client-independent: no host can silently drop it.

Deliberately one function rather than a per-tool convention, because the failure mode being fixed is
exactly the kind that returns one tool at a time. No tool handler changed — all seventeen already
funnelled through those three functions.

The 60 KB budget is unchanged and still measures what the model consumes, since `fittingCount`
binary-searches on the same string that is now mirrored.

**Guarded by `tools/__tests__/mirroring-contract.test.ts`**, in two layers, because a test suite
that stays green through an outage is the deeper defect:

- A sweep over the production registry asserting that any `structuredContent` is carried by a
  `content` block. Verified to bite by temporarily reverting the fix.
- A source-level check that no file under `src/tools/` builds a `content` array by hand. The first
  layer has a blind spot — with an empty upstream, most data tools return a _mirrored error_, so a
  new tool hand-rolling an unmirrored success could otherwise slip past.

### [#4299](https://github.com/Urigo/accounter-fullstack/pull/4299) — log the `initialize` handshake

Every `initialize` now emits one structured line tagged `event: "mcp_initialize"`, joining
`tool_call` as the second selectable event. It carries `clientName` and `clientVersion` — the fields
that date a client-side change — alongside `requestedProtocolVersion` versus
`servedProtocolVersion`, a `protocolVersionMismatch` boolean, `clientCapabilities` (names only), and
the usual `userId` / `correlationId` so a session joins across both events.

`describeInitializeParams` is deliberately total: `params` arrives as `unknown` and a malformed
handshake still produces a line rather than an exception, because a client sending something this
server cannot parse is precisely the event worth seeing. Caller-derived fields are merged beneath
the canonical ones, so `clientInfo` cannot be used to attribute a call to a different user.

The runbook gains §3.1 with the field reference and `jq` recipes, including the query that would
have dated this incident in one command.

### What the follow-up probes revealed about the client

Testing whether a declared `outputSchema` would reach the model turned up a second property of the
same client, in the same version window: **Desktop defers tool definitions.** Until the model
chooses to load one, it is shown roughly the first sentence of the description — not the input
schema, not the output schema, not the rest of the prose.

That is consistent with the same context-minimizing rework the log evidence points at, and it made a
latent problem visible. Our scope-discovery instruction — _"call it first … pass the returned
`memberBusinessId` values as `memberBusinessIds`"_ — was sentence two of
`accounter_list_business_memberships`. It did not arrive until the model explicitly loaded the
definition, which meant the "discover, then scope" contract that the whole multi-business design
rests on was reaching the model only by chance.

### Follow-up work the incident produced

Three further changes came out of investigating it, rather than out of fixing it:

- **[#4302](https://github.com/Urigo/accounter-fullstack/pull/4302) — one money shape.** Auditing
  the row layer for a possible `outputSchema` turned up drift that had already happened:
  `normalizeAmount` was meant to be the single definition of how money appears in a result, and the
  same `raw -> value` mapping had been rewritten by hand in `search_charges` and `balance_report`.
  Three copies, nothing keeping them in step. Collapsed onto one, pinned by a contract test
  asserting key names _and order_ against real tool output — order matters because the mirrored
  `content` block is `JSON.stringify(structuredContent)`.

- **[#4303](https://github.com/Urigo/accounter-fullstack/pull/4303) — `outputSchema`, closed by
  experiment.** See the decision below.

- **[#4306](https://github.com/Urigo/accounter-fullstack/pull/4306) — document each tool's result.**
  The direct consequence of learning that the description is the only channel that reaches the
  model. Shared `resultEnvelopeDescription` / `writeResultDescription` clauses live beside the
  functions that build those envelopes so prose and shape cannot drift; both write tools had
  documented nothing about their result at all; and `accounter_list_business_memberships` had its
  scope-discovery instruction moved into sentence one, because that is the only sentence a deferred
  definition guarantees.

## Decisions taken deliberately

**We did not declare `outputSchema` per tool — and this is now measured, not judged.** It was
initially deferred on cost: "servers **MUST** provide structured results that conform" would bind
all seventeen tools, for a benefit nobody had verified. So it was tested on one, and the answer was
no. Claude Desktop does not surface a declared `outputSchema` to the model — established after
ruling out a cached `tools/list` with a marker string, at which point the model enumerated the
loaded definition as name, description, input schema and said outright that there was no output
schema. Since model comprehension was the entire upside — validation is the _risk_, not the benefit
— declaring schemas for a field the model never sees buys nothing. Full evidence, including the
known limit that we never tested whether the host _validates_ against one, is in
[`connector-gaps-and-decisions.md`](../connector-gaps-and-decisions.md).

Combined with the incident itself, the model sees **neither** `structuredContent` nor `outputSchema`
on this client. `content` is the only channel, now on two independent measurements rather than
inference — which makes the mirroring above permanent rather than provisional.

**We did not change protocol-version negotiation.** The server continues to answer `2025-06-18`
unconditionally. Altering what it advertises is a live behavioral change to a connector that has
just broken once, and should be decided against a logged mismatch rather than a guess — which
`protocolVersionMismatch` now supplies.

**We kept `structuredContent` alongside the mirrored text.** The duplication is confined to wire
bytes: the model reads `content` only, which is why the outage happened at all, so nothing is
counted twice in its context. Removing either channel means choosing which one to trust, and
choosing wrong is what caused this incident. The duplication is the premium paid for not having to
choose.

## Lessons

1. **Never let a payload depend on optional client behavior.** If the specification says a client
   _may_ ignore a field, it will eventually ignore it. Put the data where delivery is guaranteed,
   and treat any second channel as redundancy rather than as the primary.

2. **Test the channel, not the object.** A suite that verifies internal shape while never asserting
   what crosses the boundary will pass through a total outage. The question a test must answer is
   not "did we build the right payload" but "would the recipient receive it".

3. **Log every boundary you do not control — and check the log would actually fire.** The handshake
   was the one hop with no record, and it was the hop where the world changed. Diagnosis depended on
   log files on a developer's laptop that a production deployment would never have. But the fix has
   a blind spot worth naming: handshake logging cannot detect a client that stops handshaking. A
   client moving to a protocol revision with no `initialize` produces _silence_, not a changed
   version, so we would learn at failure time — the same shape as this incident. An alarm you have
   not checked can fire is not yet an alarm.

4. **Partial success is worse than failure.** Correct counts with missing rows produced a plausible
   wrong answer and misdirected the investigation. Where a payload can be partly delivered, prefer
   an explicit failure.

5. **Act on the insight when you have it.** The observation that `content` is what the model reads
   was written down in a code comment weeks before the outage, and applied to one derived field
   instead of to the rows.
