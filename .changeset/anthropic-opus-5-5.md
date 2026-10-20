---
'@accounter/server': patch
---

Switch document OCR (extraction and the follow-up business matching) from `claude-sonnet-4-5` to
`claude-opus-5-5`, and enable server-side refusal fallbacks so a safety-classifier decline is
retried on a fallback model instead of failing the extraction.
