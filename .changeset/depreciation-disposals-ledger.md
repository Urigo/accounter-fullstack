---
'@accounter/server': patch
---

Book disposals and cost refunds of depreciated assets. A sale charge gets the derecognition entries
(released accumulated depreciation, gain or loss); write-offs without a charge are booked by the
yearly depreciation charge, and yearly depreciation is pro-rated to each disposal date. A cost
refund charge reduces the asset's cost and books the depreciation the refund reverses as ordinary
income, to the depreciation correction category, with no gain or loss. A sale or refund charge whose
own entries don't credit its tax category with the proceeds and cost reductions gets a ledger error.
