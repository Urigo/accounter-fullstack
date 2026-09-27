---
'@accounter/client': patch
---

Dynamic report leaves now carry the entity's ledger fingerprint (runtime-only, never saved in the
template), and the baseline diff gains a `records` change kind: a leaf whose ledger records changed
while its total stayed the same is marked "edited" with the tooltip "Ledger records changed — total
unchanged". Legacy snapshots without fingerprints show no such marker. Effect 2's value patch is
extracted into a tested `patchLeafValues` helper that also refreshes fingerprints.
