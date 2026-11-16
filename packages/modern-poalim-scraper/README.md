# israeli-bank-scrapers-modern-schemas

A new architecture for Israeli bank scrapers to hopefully merge into
[Israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) when they are ready

This project is very heavily inspired by
[israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers). I was using their
scrapers but needed to get:

1. The original and full responses from the scrapers and not a normalized one
2. Fully type safe, including the HTTP responses themselves
3. Verified against schemas - I wanted to be notified if a bank started sending something a bit
   different and to understand exactly each field they are sending

I believe this project could be integrated into the original bank scrapers. Or as a dependency (all
the additions above are optional with a config) or directly integrating the code.

Currently this library supports Bank Hapoalim, Bank Hapoalim business (with SMS login) and Isracard.

Should be easy to migrate more scrapers from
[israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) into this new form.

## Requirements

The scrapers run on the **Google Chrome installed on the machine** (`channel: 'chrome'` in both
puppeteer and Playwright), not on a browser build downloaded by those libraries. Install it from
[google.com/chrome](https://www.google.com/chrome/).

To launch a different Chrome or Chromium, pass its path; it is used instead of the installed Chrome:

```ts
const scrapers = await init({ browser: { executablePath: '/path/to/chrome' } })
```

`init()` passes the same `browser` option on to the Otsar Hahayal scraper, which also accepts it
directly in its options. The library reads no environment variables for this.

## Trying a scraper locally

The dev scripts (`yarn workspace @accounter/modern-poalim-scraper test:hapoalim`, `test:isracard`,
`test:max`, `test:otsar-hahayal`; sources in `src/test/`) launch a real browser, so they need Google
Chrome installed as well.
