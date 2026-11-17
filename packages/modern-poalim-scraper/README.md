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

## Trying a scraper locally

`src/test/scrape-*.ts` run one scraper against the real site with your own credentials (e.g.
`yarn workspace @accounter/modern-poalim-scraper test:hapoalim`). Copy
[`.env.template`](./.env.template) to `.env` in this package and fill in only the sources you want
to try. The library itself reads no environment variables; callers such as `scraper-app` pass
credentials in.
