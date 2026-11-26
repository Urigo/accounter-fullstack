---
'@accounter/modern-poalim-scraper': minor
---

Add a Bank Leumi scraper for personal accounts (`init().leumi(...)`). It signs in through the
browser and then reads the bank's own JSON API directly: accounts, shekel transactions, credit cards
and their billing cycles, mortgages and their tracks, deposits, and the securities profile.
Foreign-currency accounts are read from the bank's rendered page. Every response is checked against
a strict schema and returned as `{ data, isValid, errors }`.
