## Etana Scraper

The goal of this package is to implement a scraper based on Etana export files.

### Getting Started

1. Using Etana CRM dashboard, use the `Accounts` sidebar, pick your account and click on Export.
   Store the `.csv` file

2. Create the `.env` file in this directory from the template, then fill in the values. Every
   variable is documented in [`.env.template`](./.env.template):

```sh
cp .env.template .env
```

1. Run the scraper using `yarn dev` (watch mode) or `yarn build` and then `yarn start`.
