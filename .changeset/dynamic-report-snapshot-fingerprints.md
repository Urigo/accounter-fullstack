---
'@accounter/server': patch
'@accounter/client': patch
---

Dynamic report snapshots now store the ledger fingerprint of every entity on screen at save time.
`DynamicReportSnapshotValueInput` requires a `fingerprint`, which the client copies from each
business sum's `ledgerFingerprint`. `DynamicReportSnapshotValue.fingerprint` returns the stored
value, or null for snapshots saved before fingerprints existed.
