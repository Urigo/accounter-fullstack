---
'@accounter/server': patch
---

Stop reporting Poalim SWIFT transactions as changed when an optional field (e.g.
`swift_remittance_information_70`) is stored as `null` and the scraper sends a blank placeholder for
it. Blank and `null` values are now treated as equal when diffing.
