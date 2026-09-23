---
'@accounter/server': patch
---

Move document OCR from `claude-sonnet-4-5` to `claude-sonnet-5`.

Sonnet 5 is a newer generation at a lower input price ($2/MTok against Sonnet 4.5's $3/MTok), so
this compounds with the prompt-cache prefix landed alongside it. Both models share the same
1024-token minimum cacheable prefix, so the caching arithmetic is unchanged.

Kept as its own commit because caches are model-scoped: the switch invalidates any warm entries
once, and isolating it keeps an extraction-accuracy regression attributable to the model rather than
to the prompt restructure.
