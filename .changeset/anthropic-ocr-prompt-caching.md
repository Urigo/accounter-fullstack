---
'@accounter/server': patch
---

Make the OCR prompt cacheable, and collapse the two Anthropic calls per document into one.

Anthropic flagged a near-zero prompt-cache hit rate on our API spend. The cause was structural
rather than a missing tuning knob: `cache_control` appeared nowhere in the repo, so no request ever
wrote or read a cache entry.

Prompt caching is a strict prefix match, which means content is only reusable when every byte ahead
of it is identical. The OCR prompt had its stability order inverted. `extractInvoiceDetails` made
two calls — one to extract the document's fields, then a conditional second one to match the issuer
and recipient — and the second appended the tenant's **entire business catalog** as its final
message, behind the per-document file. The catalog is the largest and most stable content in the
system (identical for every document a tenant processes), but sitting behind a payload that differs
every time, it could never be part of a reusable prefix and was re-billed at full price on every
document. The two calls could not share a prefix either, since they use different output schemas and
constrained-decoding grammar renders ahead of both system and messages.

- One `generateText` call per document. The extraction schema gained optional `issuerMatch` /
  `recipientMatch` fields, so the model resolves both sides in the same pass that reads the
  document. `.optional()` rather than `.nullable()`, per the schema's existing grammar-budget rule,
  which also keeps an unresolved match from failing validation — preserving the property that a
  failed match degrades the result instead of failing the extraction.
- The instructions and business catalog moved into a `system` message carrying a
  `cacheControl` breakpoint with a 1-hour TTL; the document now follows it in the user turn.
  Stable content precedes volatile content, so the catalog is written once per tenant and read back
  at 0.1x on every subsequent document within the TTL.
- `serializeBusinessCatalog` replaces the inline catalog build and imposes a **total** order
  (priority descending, then id). The previous sort keyed on `suggestion_data.priority` alone, which
  leaves every business sharing a priority — all of them, since it defaults to 0 — in an
  unspecified relative order. Against a byte-matched cache prefix that is a silent invalidator: a
  reshuffle costs full input price and reports no error. `matchBusiness` reuses the same comparator,
  so its equal-priority phrase matches are now stable too.
- `EmailIngestionIngestProvider.prepareDocuments` processes the first document of a batch before
  fanning the rest out. A cache entry is not readable until the request that writes it begins
  streaming, so the previous flat `Promise.all` had every document in a batch miss and write its own
  copy of the catalog, paying the write premium N times instead of once.
- Every call now logs `cacheReadTokens` / `cacheWriteTokens` alongside the input and output counts,
  and emits AI SDK telemetry spans through the existing OpenTelemetry setup. The expensive failure
  mode here is silent — a later change to prompt assembly stops the prefix matching, requests keep
  succeeding, and only the bill moves — so these counters are the standing check that caching still
  works.

Behavior is otherwise preserved: the deterministic `matchBusiness` remains primary with the model's
suggestion consulted only for a side it leaves unresolved, matches are still validated against the
catalog so a hallucinated UUID cannot reach the document pipeline, and the match is still scoped to
financial document types.

Note the trade-off: the catalog is now sent with every document, where before it accompanied only
documents that failed deterministic matching. Cache writes cost 1.25x base input (2x at the 1-hour
TTL) against reads at 0.1x, so this pays off from roughly the third document per tenant per hour. A
tenant below that rate with a large catalog could see a small increase — the logged counters are
there to settle that empirically, and the cheap adjustments are dropping to the default 5-minute TTL
or gating the catalog on its size.
