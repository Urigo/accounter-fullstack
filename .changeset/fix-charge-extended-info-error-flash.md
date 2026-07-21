---
"@accounter/client": patch
---

Fix a spurious "Error fetching extended information for this charge" flash in the charge expansion
panel. The rendered `charge` is committed to state in an effect one render after `fetching` flips to
`false` and the fetched data arrives, so the error gate briefly saw `!fetching && !charge` as true.
The error is now also gated on `incomingCharge` (the synchronous derivation of the fetched data),
suppressing the flash during that one-render gap while still surfacing genuine "no data" errors.
