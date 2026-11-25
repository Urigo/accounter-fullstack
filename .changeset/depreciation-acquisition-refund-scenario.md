---
'@accounter/server': patch
---

Test the acquisition cost-refund case end to end: a DB-backed scenario that generates the ledger of
the acquisition, refund and yearly depreciation charges and reads the depreciation report, asserted
against the updated spec. The test fixtures can now insert misc expenses, exchange rates and
depreciation categories, records and disposals, and a transaction-scoped pool runs the ledger test
context inside a rolled-back test transaction.
