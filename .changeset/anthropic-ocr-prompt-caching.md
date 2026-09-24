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
  which also keeps an unresolved match from failing validation. That covers a match the model
  omits, not a request that fails, so if the combined request fails the provider retries once
  without the catalog — exactly what the standalone extraction call used to send — and keeps the
  deterministic match alone. A failed match still degrades the result instead of failing the
  extraction, at the cost of one extra call on the failure path only. A model match is also only
  accepted for a side the document actually has, as the separate match call only asked about
  extracted names.
- The instructions and business catalog moved into a `system` message carrying a
  `cacheControl` breakpoint; the document now follows it in the user turn.
  Stable content precedes volatile content, so the catalog is written once per tenant and read back
  at 0.1x on every subsequent document within the TTL.
- `serializeBusinessCatalog` replaces the inline catalog build and imposes a **total** order
  (priority descending, then id). The previous sort keyed on `suggestion_data.priority` alone, which
  leaves every business sharing a priority — all of them, since it defaults to 0 — in an
  unspecified relative order. Against a byte-matched cache prefix that is a silent invalidator: a
  reshuffle costs full input price and reports no error. `matchBusiness` reuses the same comparator,
  so its equal-priority phrase matches are now stable too.
- `PromptCacheGate` coordinates concurrent calls that share a prefix. A cache entry is not readable
  until the request that writes it responds, so without it every document issued at once misses and
  writes its own copy of the catalog, paying the write premium N times instead of once. The gate
  sits in the singleton `AnthropicProvider`, so it covers the interactive upload path as well as
  email ingest, and it records warmth from the response's own cache counters rather than assuming
  the write landed.
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
documents that failed deterministic matching. Measured against a week of production ingest logs,
document arrival is bursty rather than steady — documents cluster into bursts seconds apart,
separated by gaps of several hours — so the cached prefix only ever amortizes *within* a burst.

Two things follow, and both are reflected above.

- **The TTL is the 5-minute default, not an hour.** An hour never spans the gap between bursts and
  is never needed inside one, so its doubled write premium (2x base input against 1.25x) buys
  nothing. At the observed burst shape, five minutes is roughly 25% cheaper on catalog tokens.
- **Amortization is handled by a per-prefix gate, not by staggering each email.** Serializing the
  first document of a batch only coalesces within one email, and consecutive emails for one tenant
  arrive a median ~1.4s apart as separate requests — so most cache writes were being raced between
  concurrent emails, which a within-batch stagger cannot see. `PromptCacheGate` lets one call warm
  a cold prefix while its siblings wait, and lets everyone through untouched once it is warm,
  removing the round trip the stagger spent even when the cache was already warm.

The gate is keyed on the rendered prefix rather than on the tenant — which is what Anthropic itself
keys on, and which matters because one tenant can produce two different catalogs (the email and
interactive upload paths load businesses through different queries); a tenant-keyed gate would
report a warm entry the other path can never read.

Still open, and now measurable: a catalog below roughly 40 businesses cannot reach the model's
1024-token minimum cacheable prefix, so the breakpoint is a silent no-op and the catalog is billed
in full on every document. `anthropic.ocr.usage` gained `tenantId`, `gate` and `modelMatchUsed` —
the last says how often the model's match resolves a side the deterministic matcher could not, which
is what decides whether the catalog should ride on every document at all.
