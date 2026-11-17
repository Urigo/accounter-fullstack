---
'@accounter/etana-scraper': patch
'@accounter/etherscan-scraper': patch
'@accounter/kraken-scraper': patch
'@accounter/israeli-vat-scraper': patch
'@accounter/modern-poalim-scraper': patch
---

Each scraper now documents its environment variables in a `.env.template`: new templates for the
etana, etherscan and kraken scrapers (their READMEs point at them instead of inline blocks), a
described template for the VAT scraper, and a new modern-poalim-scraper template holding the bank
credentials its `src/test` dev scripts read (moved out of the root template, plus the missing
`OTSAR_HAHAYAL_*`). A repo-wide test now fails when any template lists a variable no code reads.
