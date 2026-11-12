---
---

Fix two type errors in the email-ingestion control resolver test: the resolver's declared return
type allows a plain value, so the test now wraps the call in `Promise.resolve` before chaining
`.then`. Test-only; no release.
