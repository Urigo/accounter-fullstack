## Etana Scrapper

The goal of this package is to implement a scrapper based on Etana export files.

### Getting Started

1. Using Etana CRM dashboard, use the `Accounts` sidebar, pick your account and click on Export.
   Store the `.csv` file

2. Create `.env` file in this directory with the following:

```
DATABASE_URL="<>"
CSV_EXPORT_FILEPATH="<RELATIVE_OR_ABSOLUTE_PATH_TO_CSV_FILE>"
```

1. Run the scrapper using `yarn dev` (watch mode) or `yarn build` and then `yarn start`.
