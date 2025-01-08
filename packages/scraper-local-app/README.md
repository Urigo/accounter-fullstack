# Scraper Local App

The **Scraper Local App** is a sub-package of the **Accounter Fullstack** mono-repo. It is designed
to handle data scraping tasks locally, enabling users to extract and process personal
accounting-related data efficiently in a self-contained environment.

---

## Features

- Localized data scraping for accounting tasks.
- Fully configurable through a dedicated environment configuration file.
- Seamless integration with the **Accounter Fullstack** ecosystem.

---

## Installation

To use the Scraper Local App, you need to install it as part of the **Accounter Fullstack**
mono-repo:

```bash
# Install dependencies (On monorepo root level)
yarn install

# Navigate to the root of the mono-repo
cd packages/accounter-fullstack
```

---

## Usage

The Scraper Local App relies on environment variables for its configuration. Make sure to set up the
configuration file before running the app.

### Setting Up the Configuration

1. Copy the example environment configuration file:

   ```bash
   cp src/env.template.ts src/env.ts
   ```

2. Open the `src/env.ts` file and update the values to match your setup. Below are the key
   configuration fields:

   ```typescript
   export const ENV = {
     database: '<Database connection details>',
     ...sources
   }
   ```

3. Save the changes.

### Running the App

Use the following command to start the Scraper Local App:

```bash
yarn start
```

---

## Configuration Reference

The configuration file (`src/env.ts`) defines the following options:

### General Config

- **`database`**: Details for connecting to the database where scraped data is stored. This should
  include all necessary parameters, such as host, user, password, and database name.
- **`showBrowser`** (optional, default: false): A boolean flag to indicate whether the browser
  should be displayed during scraping. Useful for debugging.

### Sources to Scrape (all optional)

- **`fetchBankOfIsraelRates`** (optional, default: true): A boolean flag that indicates whether the
  scraper should fetch exchange rates from the Bank of Israel.
- **`poalimAccounts`**: For HaPoalim bank accounts. An array of credentials for scraping data from
  Poalim accounts. Each entry should include necessary details such as username and password.
- **`isracardAccounts`**: For Isracard credit cards. An array of credentials for scraping data from
  Isracard accounts. Each entry should include required details like username and password.
- **`amexAccounts`**: For American Express credit cards. An array of credentials for scraping data
  from Amex accounts. Each entry should include relevant details such as username and password.

Ensure that all required fields are correctly set up to avoid runtime errors or unexpected behavior.

---

## Contributing

We welcome contributions! If you'd like to improve the Scraper Local App, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a clear description of your changes.

---

## License

This package is part of the **Accounter Fullstack** mono-repo and is released under the MIT License.
See the [LICENSE](../../LICENSE) file for details.

---

## Resources

- **Accounter Fullstack Repository:**
  [https://github.com/Urigo/accounter-fullstack](https://github.com/Urigo/accounter-fullstack)
- **Configuration Template:** [src/env.template.ts](./src/env.template.ts)
