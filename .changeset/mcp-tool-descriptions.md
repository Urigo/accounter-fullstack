---
'@accounter/mcp-server': patch
---

Document each tool's result in its description, since that is the only channel that reaches the
model.

Two things were measured on Claude Desktop after the blind-connector incident, and both are now
recorded in `docs/connector-gaps-and-decisions.md`:

1. The model is shown **neither** `structuredContent` nor a declared `outputSchema`. The first
   caused the incident; the second was established by declaring a schema on one canary tool and
   asking. After ruling out a cached `tools/list` with a marker string, the model enumerated the
   loaded definition as name, description, input schema — "There is no output schema."
2. Desktop **defers tool definitions**. Until the model loads one, it sees roughly the first
   sentence of the description.

Asked what a tool returns, the model reconstructed the shape from *sibling* descriptions and then
named precisely what it could not know: whether rows sit under `businesses` or `memberships`, and
whether there is a `scope` echo. That is the gap this closes.

- **`resultEnvelopeDescription(itemsKey)`** and **`writeResultDescription(itemsKey)`** live in
  `output.ts` next to the functions that build those envelopes, so the prose and the shape cannot
  drift apart. Same idiom as `SCOPE_DESCRIPTION_SUFFIX`: one shared clause, so the model learns the
  envelope once rather than in fifteen phrasings. No description previously mentioned
  `returnedCount`, `totalCount`, `truncated`, `continuation` or `itemsOmitted` at all.
- **Both write tools** documented nothing about their result. A model that has just changed data
  could not tell what confirmation to expect — including that `itemsOmitted` means the write
  *applied* and only the echo was dropped, which reads like a failure if you have not been told.
- **`accounter_list_business_memberships` is front-loaded.** Its scope-discovery instruction — call
  it first, pass the returned ids onward — was sentence two and did not arrive under deferred
  loading. It is now part of sentence one, which is the only sentence guaranteed to be read.
- **`accounter_list_tags` and `accounter_list_tax_categories`** named no output fields; they now name
  their actual keys, including `namePath` and `sortCode`.
- **Prose replaced by literal keys** where the two diverged: "file/image links" are `fileUrl` /
  `imageUrl`, and "total, VAT, withholding" are `totalAmount` / `vat` / `withholdingTax`. A
  near-miss name is worse than no name, because it reads authoritative.

Deliberately surgical rather than a rewrite. Most of these descriptions are carefully built — the
securities and upload ones especially — and the measured gap was narrow: where rows live, what the
envelope carries, and a handful of prose-versus-key mismatches.

Guarded by `description-contract.test.ts`: every list tool must name its own `itemsKey` and the four
envelope fields, every write tool must name its items key plus `ok` / `action` / `itemsOmitted`, a
first sentence has to carry more than a restatement of the tool's name, and no description may
contain a line break, a doubled space, or stray outer whitespace. That last check exists because
this changeset's own first draft shipped `\n` escapes into three descriptions — invisible in a diff,
verbatim to the model.
