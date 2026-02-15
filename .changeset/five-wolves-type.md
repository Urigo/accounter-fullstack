---
'@accounter/shaam-uniform-format-generator': patch
'@accounter/green-invoice-graphql': patch
'@accounter/modern-poalim-scraper': patch
'@accounter/israeli-vat-scraper': patch
'@accounter/shaam6111-generator': patch
'@accounter/etherscan-scrapper': patch
'@accounter/hashavshevet-mesh': patch
'@accounter/pcn874-generator': patch
'@accounter/kraken-scrapper': patch
'@accounter/etana-scrapper': patch
'@accounter/payper-mesh': patch
'@accounter/client': patch
'@accounter/server': patch
---

- **NPM Provenance**: Enabled NPM provenance for all packages by adding `"provenance": true` to the `publishConfig` section in their respective `package.json` files.
- **Supply Chain Security**: Enhanced the supply chain security of published packages, allowing
  consumers to verify the origin and build process.
