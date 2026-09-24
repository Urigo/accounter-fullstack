---
'@accounter/server': patch
'@accounter/client': patch
---

Dynamic report snapshots now store a ledger fingerprint next to every value they store: one per
entity with ledger activity in the period, whether or not that entity is placed in the report.
`DynamicReportSnapshotValueInput` now requires a `fingerprint`, which the client copies from each
business sum's `ledgerFingerprint`; this is a breaking input change, and this client is its only
caller. `DynamicReportSnapshotValue.fingerprint` returns the stored value, or null for snapshots
saved before fingerprints existed.
