---
'@accounter/modern-poalim-scraper': patch
'@accounter/scraper-app': patch
---

Bank deposits: `getDepositsTaxCollection` fetches Poalim's deposits tax-collection report
(interest realized per deposit event and the tax on it), authenticated from the logged-in page like
the other Poalim calls. scraper-app gets a per-source "Fetch deposits tax events" switch, uploads the
rows through `uploadPoalimDepositTaxEvents` (skipping today's still-open events), and shows a
"Deposit tax" cell per account in the task row.
