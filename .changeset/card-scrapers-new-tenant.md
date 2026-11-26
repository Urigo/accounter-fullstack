---
'@accounter/modern-poalim-scraper': patch
'@accounter/scraper-app': patch
'@accounter/server': patch
---

Fixes found while connecting a new tenant's credit cards:

- CAL: the card digits are optional (all cards of the login are fetched), a wrong card reports the
  cards that do exist, and uploads map currency, dates and card number to what the server accepts.
- Max: the login waits for the password tab properly, reports what the page shows when login does
  not complete, and can answer the ID-number prompt.
- Amex / Isracard raw tables no longer truncate long text, a transaction without a purchase date
  falls back to its charge date, and a CAL transaction in a currency Accounter does not track is
  stored in its debit currency.
- The server no longer crashes when no exchange rates are stored yet.
