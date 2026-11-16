## Etherscan Scraper

The goal of this package is to implement a scraper based on Etherscan API, to fetch information
about wallets receiving tokens on the ERC-20 protocol.

### Getting Started

1. Create the `.env` file in this directory from the template, then fill in the values. Every
   variable is documented in [`.env.template`](./.env.template):

```sh
cp .env.template .env
```

> The `ETHERSCAN_API_KEY` can be fetched from Etherscan account page.

> The `WALLETS_TO_SCAN` needs to be built in the construct of `WALLET:CONTRACT_ADDRESS` - and many
> can be specified.

2. Run the scraper using `yarn dev` (watch mode) or `yarn build` and then `yarn start`.

### Contracts Examples

- `USDC` is `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
- `GRT` is `0xc944E90C64B2c07662A292be6244BDf05Cda44a7`
