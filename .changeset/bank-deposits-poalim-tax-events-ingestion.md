---
'@accounter/server': patch
---

Bank deposits: new `poalim_deposit_tax_events` table (1:1 with Poalim's deposits tax-collection
`savingsAndCurrentProductsTaxEvents[]`, with RLS) and a scraper-role
`uploadPoalimDepositTaxEvents` mutation that upserts on account + executing date + daily serial.
`bank_deposits` now has RLS as well.
