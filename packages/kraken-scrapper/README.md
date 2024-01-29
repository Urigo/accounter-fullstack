## Kraken Scrapper

The goal of this package is to implement a scrapper based on Kraken API, and fetches ledger records
and trade records.

### Getting Started

1. Create `.env` file in this directory with the following:

```
KRAKEN_API_KEY="<>"
KRAKEN_API_SECRET="<>"
DATABASE_URL="<>"
ACCOUNT_PREFIX="<>"
```

> The `KRAKEN_API_KEY` and `KRAKEN_API_SECRET` can be fetched from your Kraken account page, please
> make sure to include the `Query ledger entries`, `Query open orders & trades`,
> `Query closed orders & trades` and `Query funds` permissions.

> The `ACCOUNT_PREFIX` variable is helpful if you have multiple tenants, and you wish to make sure
> to have a unique name and link to the trades and ledger records (since Kraken API doesn't provide
> a unique ID for accounts/wallets).

1. Run the scrapper using `yarn dev` (watch mode) or `yarn build` and then `yarn start`.
