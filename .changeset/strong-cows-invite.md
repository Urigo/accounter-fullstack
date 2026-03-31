---
'@accounter/green-invoice-graphql': patch
'@accounter/modern-poalim-scraper': patch
'@accounter/israeli-vat-scraper': patch
'@accounter/hashavshevet-mesh': patch
'@accounter/gmail-listener': patch
'@accounter/payper-mesh': patch
'@accounter/client': patch
---

- **Environment Variable Cleanup**: Removed hardcoded and auto-generated environment variables like
  DEFAULT_FINANCIAL_ENTITY_ID and Gmail credentials from the main configuration, promoting a cleaner
  and more secure setup.
- **Configuration Loading Improvements**: Updated various packages to support loading environment
  variables from both local and parent directory files, improving flexibility across different
  environments.
