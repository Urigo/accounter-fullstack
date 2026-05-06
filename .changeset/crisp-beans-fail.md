---
'@accounter/scraper-app': patch
---

- **Granular Progress Events**: Replaced legacy progress messages with 10 precisely-typed WebSocket
  events, providing real-time visibility into per-month and per-account scraping progress.
- **Non-Fatal Scrape Loops**: Updated Isracard, Amex, Discount, and Cal scrapers to use a non-fatal
  month-by-month loop, allowing tasks to continue even if a specific month fails.
- **UI Progress Tracking**: Added a new TaskSteps sub-component to the UI, enabling users to monitor
  granular progress via collapsible sub-rows for months or accounts.
- **Poalim Account Discovery**: Implemented per-account and per-transaction-type progress reporting
  for Poalim, including vault status checks.
