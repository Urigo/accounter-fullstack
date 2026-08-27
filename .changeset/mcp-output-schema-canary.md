---
'@accounter/mcp-server': patch
---

Support `outputSchema`, and declare one on a single tool as a canary.

No tool has ever advertised an `outputSchema`, which is why `structuredContent` was a field clients
were free to ignore — and why they eventually did, taking every row with it. Whether declaring one is
worth having is still an open question: the benefit (does the client validate? does it show the
schema to the model?) is unverified, while the cost is certain, because "servers **MUST** provide
structured results that conform" applies to all seventeen tools at once.

So this adds the mechanism and exercises it on exactly one tool rather than committing to all of
them. `accounter_list_business_memberships` is the canary: pure, no upstream call, three flat fields,
and a summary line that already tells the model to pass `memberBusinessId` onward — so if a client
does surface a declared schema, that is where it should show.

**Generated, never hand-written.** `ToolDefinition.outputSchema` is a Zod schema, matching the input
side, and `describe()` renders it with `z.toJSONSchema`. The canary's row type is `z.infer` of the
same schema that is advertised, so the handler cannot build a row the schema does not describe. A
hand-written JSON Schema would have been the opposite: a second document, free to drift, backed by a
MUST.

`output.ts` gains `listOutputSchema(itemsKey, row, extra?)`, which wraps a row schema in the exact
envelope `shapeListResult` builds — items, `returnedCount`, `totalCount`, `truncated`, and an
optional `continuation`. That is the reusable half if the remaining tools follow.

Tools that declare nothing are unchanged, and `tools/list` omits the key entirely for them rather
than emitting an empty contract a client might try to validate against.

Guarded by `output-schema-contract.test.ts`, which is registry-driven: every tool declaring a schema
is executed and its real `structuredContent` parsed against its own advertised schema. Tools that
gain schemas later are covered without extending the file.

This changes nothing about the `content` mirror. That exists because a client may ignore
`structuredContent` for any reason, which a declared schema does not prevent.
