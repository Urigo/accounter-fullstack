# israeli-vat-scraper

# Pre execution:

- Install [Google Chrome](https://www.google.com/chrome/). The scraper launches the installed
  Chrome, not a browser downloaded by puppeteer.
- Add the following credentials as environment variables:
  - VAT_NUM
  - USER_CODE
  - USER_PASS
- Alternatively, add the credentials as input to the scraper function

# Development:

- make schema fields as strict as possible
- expand configurations (limit years, validate with schema, etc)
- add scalars to data attributes
