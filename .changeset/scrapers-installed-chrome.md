---
'@accounter/modern-poalim-scraper': minor
'@accounter/scraper-app': patch
'@accounter/israeli-vat-scraper': patch
---

Run the scrapers on the installed Google Chrome instead of a browser build downloaded by puppeteer or
Playwright, so dependency bumps no longer break scraping.

- `@accounter/modern-poalim-scraper`: `init()` and the Otsar Hahayal scraper now launch with
  `channel: 'chrome'`, so **Google Chrome must be installed**. A new optional
  `browser: { executablePath }` option on `init()` (passed on to Otsar Hahayal) and on
  `OtsarHahayalOptions` launches a different Chrome/Chromium instead.
- `@accounter/scraper-app`: a missing Chrome now shows "Google Chrome is not installed. Install it
  from https://www.google.com/chrome/ and run the scrape again." on the task row instead of the raw
  library error.
- `@accounter/israeli-vat-scraper`: launches the installed Google Chrome (`channel: 'chrome'`).
