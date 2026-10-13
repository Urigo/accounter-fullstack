---
'@accounter/server': patch
---

Make the OCR business-match prompt cacheable, and stop re-sending the document to match it.

Anthropic flagged a near-zero prompt-cache hit rate on our API spend. The cause was structural
rather than a missing tuning knob: `cache_control` appeared nowhere in the repo, so no request ever
wrote or read a cache entry.

Prompt caching is a strict prefix match, which means content is only reusable when every byte ahead
of it is identical. The OCR prompt had its stability order inverted. `extractInvoiceDetails` made
two calls — one to extract the document's fields, then a conditional second one to match the issuer
and recipient. The second re-sent the original user turn (the document included) plus the first
answer, and appended the tenant's **entire business catalog** as its final message. The catalog is
the largest and most stable content in the system, identical for every document a tenant processes.
Sitting behind a payload that differs every time, it could never be part of a reusable prefix and
was re-billed at full price on every match, together with a second copy of the document.

- The match call keeps its trigger — a financial document with a named side that `matchBusiness`
  could not resolve — but is rebuilt to be cheap.
  - Its `system` message holds the match instructions and the catalog, with a 5-minute
    `cacheControl` breakpoint, so the catalog is written once per tenant and read back at 0.1x by
    every later match within the TTL.
  - Its user turn is a few lines of extracted text: the unresolved side's name, its VAT number, and
    the document description. The document is never re-sent.
  - Matches are still validated against the catalog, so a hallucinated UUID cannot reach the
    document pipeline. A model match is applied only to a side that was asked about. A failed
    match is logged and swallowed, keeping the deterministic result.
- The extraction call is unchanged in substance: instructions in `system`, the document in the user
  turn. It carries no catalog, no breakpoint, and is not gated. The instructions alone are far below
  the 1024-token minimum cacheable prefix, so there is nothing to write.
- `serializeBusinessCatalog` replaces the inline catalog build and imposes a **total** order
  (priority descending, then id). The previous sort keyed on `suggestion_data.priority` alone, which
  leaves every business sharing a priority — all of them, since it defaults to 0 — in an
  unspecified relative order. Against a byte-matched cache prefix that is a silent invalidator: a
  reshuffle costs full input price and reports no error. `matchBusiness` reuses the same comparator,
  so its equal-priority phrase matches are now stable too.
- `PromptCacheGate` coordinates concurrent match calls that share a prefix. A cache entry is not
  readable until the request that writes it responds, so without it every miss in a batch writes its
  own copy of the catalog. The gate sits in the singleton `AnthropicProvider`, so it covers the
  interactive upload path as well as email ingest. It records warmth from the response's own cache
  counters rather than assuming the write landed, and never moves an entry's warm window backwards.
- Every call logs an `anthropic.ocr.usage` line: `call` (`extract` / `match`), `tenantId`, token
  counts and `cacheReadTokens` / `cacheWriteTokens`. Extract lines carry `documentType`; match lines
  carry `catalogSize`, `gate` and `modelMatchUsed`. Calls also emit AI SDK telemetry spans through
  the existing OpenTelemetry setup. The expensive failure mode here is silent — a later change to
  prompt assembly stops the prefix matching, requests keep succeeding, and only the bill moves — so
  these counters are the standing check that caching still works.

Why the catalog is not sent with every document, measured against a week of production gateway
logs: arrival is too sparse and too mixed for it to pay.

- A low-volume tenant (~3 documents a day) almost never has two documents within five minutes, so
  nearly every request would pay the cache-write premium (1.25x) for an entry nobody reads.
- A high-volume tenant (~28 a day) arrives mostly in batches of emails seconds apart, separated by
  gaps of hours. About half its documents are rendered email bodies, which can never use the catalog.
- Riding on every request, the catalog would cost about 0.95x and 0.40x of its token price per
  document respectively. Sent only on a deterministic miss, it costs at most about 0.5x and 0.25x
  even if *every* attachment missed, and proportionally less at realistic miss rates. Non-financial
  documents and deterministic hits pay nothing for it.

The TTL is the 5-minute default, not an hour. Within a batch five minutes is ample, and an hour
never spans the gap between batches, so its doubled write premium (2x base input against 1.25x)
buys nothing.

Still open, and now measurable: `match` lines over `extract` lines with a financial `documentType`
is the deterministic matcher's miss rate per tenant, which is what the catalog actually costs. A
catalog below roughly 35–40 businesses cannot reach the model's 1024-token minimum cacheable prefix,
so for a small tenant the breakpoint is a silent no-op; both cache counters at zero on match lines
says so.
