---
'@accounter/modern-poalim-scraper': minor
'@accounter/scraper-app': minor
'@accounter/server': minor
'@accounter/client': minor
---

Card hints at ingestion. The Otsar Hahayal scraper gains `fetchCardDebitDetails` (on by default, on in scraper-app): it fetches only the card-breakdown drill-down of the bank's card-debit rows and stores the card's last 4 digits as `originReference`. Server ingestion fills that hint into a row stored without it instead of inserting a duplicate.
`FILL_CREDITCARD_DEBIT_DATES` is now bank-agnostic (any strong card hint, shared `bank_transaction_card_hints` view, Cal included), and `CardFinancialAccount.suggestedSettlementAccount` proposes a card's settlement account from its link history, with a one-click "Use" in the card account dialog.
