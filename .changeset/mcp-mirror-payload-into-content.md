---
'@accounter/mcp-server': patch
---

Mirror every tool payload into `content`, so rows actually reach the model.

The connector had gone blind: asking for a counterparty's charges returned
`Found 7 charge(s) across 2 businesses; showing 7 on page 1 of 1.` and nothing else — no ids, dates,
amounts or business names. Every tool behaved the same way, and the model could not work around it
by changing filters, because there was nothing to filter.

**Cause.** Every list tool funnels through `shapeListResult`, which put the summary line in `content`
and the rows *only* in `structuredContent`. Under MCP 2025-06-18 `structuredContent` is
contractually meaningful only when a tool advertises an `outputSchema` — none of ours ever have, and
none ever did — so a client is free to ignore it, and the spec correspondingly asks a server
returning structured content to *also* return it serialized in a `TextContent` block. This server
did neither, and every tool's data depended on undefined-by-spec client behaviour. When the client
stopped surfacing unschema'd structured content, the rows stopped arriving.

This was never a regression here: `shapeListResult`'s return statement was byte-identical to its
original from the very first commit of the package, and `executeRegisteredTool` /
`dispatchMcpRequest` pass the result through untouched. It was an original design gap that only
became visible when the assumption underneath it changed.

**Fix.** A single `mirroredResult(summary, structured)` in `src/tools/output.ts`, which
`shapeListResult`, `shapeWriteResult` and `toToolErrorResult` all now return through. The summary
still leads — a cheap orientation line before the payload — followed by the serialized JSON, with
`structuredContent` kept as-is for hosts that consume it directly. Deliberately one function rather
than a per-tool convention: the failure mode being fixed is exactly the kind that drifts back one
tool at a time. No tool handler changed; all nineteen already route through those three functions.

Two things this restores that were less obvious than the missing rows:

- `accounter_list_business_memberships` instructs the model to "Pass their `memberBusinessId`
  values", while those ids lived only in the invisible field. Discovery that cannot be acted on
  breaks the scoping workflow every other tool depends on.
- Error payloads were mirrored too. `VALIDATION_ERROR` carries field-level `issues`, and a rejected
  call whose issues never reach the model tells it only *that* it was wrong, never *what* to fix — so
  it retries the same shape. `accounter_explain_terminology` was likewise returning the entire
  glossary into a field nothing read.

The 60KB budget is unchanged and still measures what the model consumes: `fittingCount` binary-
searches on `JSON.stringify(structured)`, which is now exactly the mirrored text. The JSON-RPC body
roughly doubles, which is far under the 1MB transport cap. A client that renders both channels sees
the payload twice; that is the accepted cost of not depending on which one it reads.

**Guarded by `tools/__tests__/mirroring-contract.test.ts`**, because the real failure here was that
the suite stayed green while the connector was blind — rows were asserted exclusively through
`structuredContent`, and no test anywhere checked that one reached `content`. It closes that in two
layers: a sweep over the production registry asserting any `structuredContent` is carried by a
`content` block, and a source-level check that no tool builds a `content` array by hand. The second
layer exists because the first has a blind spot — with an empty upstream most data tools return a
*mirrored error*, so a new tool hand-rolling an unmirrored success could otherwise slip past it.
