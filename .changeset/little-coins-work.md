---
'@accounter/shaam-uniform-format-generator': patch
'@accounter/green-invoice-graphql': patch
'@accounter/modern-poalim-scraper': patch
'@accounter/israeli-vat-scraper': patch
'@accounter/shaam6111-generator': patch
'@accounter/hashavshevet-mesh': patch
'@accounter/pcn874-generator': patch
'@accounter/payper-mesh': patch
'@accounter/client': patch
'@accounter/server': patch
---

- **Configurable NPM Registry in CI**: The GitHub Actions setup now includes a `registryUrl` input,
  allowing for flexible specification of the NPM registry during package publishing.
- **Deterministic Dependency Installation**: The `yarn install` command in the CI workflow was
  updated to use `--frozen-lockfile`, ensuring consistent and reproducible builds by preventing
  modifications to the `yarn.lock` file.
- **Standardized Package Metadata**: `package.json` files across several packages were updated to
  include comprehensive and consistent metadata, such as `description`, `repository` details,
  `homepage`, `bugs` URL, and `author` information.
- **Explicit NPM Registry Configuration**: The `publishConfig` in multiple `package.json` files was
  modified to explicitly set the `registry` to `https://registry.npmjs.org`, clarifying the target
  for package publication.
