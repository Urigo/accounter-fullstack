# Modern Israeli Bank Scrapers

A modern architecture for Israeli bank scrapers, designed to offer enhanced developer experience
through type safety and schema validation.

> 🙏 **Credit**: This project is heavily inspired by and builds upon the amazing work in
> [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers). All credit for the
> original scraping logic and concept goes to that project.

---

## ✨ What’s Different

This project was created to support a few additional goals that were important for our use case:

- **Access to Raw Data**  
  Retrieve the full, original HTTP responses — not just normalized outputs.

- **Full Type Safety**  
  Strong typing throughout the codebase, including HTTP responses, for safer and clearer
  development.

- **Schema Validation**  
  Automatically validate server responses against defined schemas to detect unexpected changes
  (**optional** and can be toggled via configuration).

---

## 🏦 Supported Scrapers

- Bank Hapoalim (personal)
- Bank Hapoalim Business (with SMS login)
- Bank Discount
- Isracard
- Visa CAL
- Visa MAX
- American Express

---

## 📦 Installation

Install the package using your preferred package manager:

```bash
yarn add @accounter/modern-israeli-scrapers
```

or with npm:

```bash
npm install @accounter/modern-israeli-scrapers
```

> Make sure you're using Node.js 18+ for best compatibility (due to Puppeteer and ESM support).

---

## 🚀 Usage

Here’s a minimal example of using the Isracard scraper:

```ts
import { init } from '@accounter/modern-israeli-scrapers'

async function main() {
  const { isracard, close } = await init({ headless: false })

  try {
    const scraper = await isracard({
      ID: 'ISRACARD_ID',
      password: 'ISRACARD_PASSWORD',
      card6Digits: 'ISRACARD_6_DIGITS'
    })

    const dashboards = await scraper.getDashboards()
    console.log(dashboards)
  } catch (error) {
    console.error('Scraping failed:', error)
  } finally {
    await close()
    console.debug('Scraping session closed')
  }
}

main()
```

### 📌 Notes

- `init({ headless: false })` launches the browser in non-headless mode for debugging. Set it to
  `true` in production.
- Credentials (`ID`, `password`, `card6Digits`) should be securely loaded (e.g., from environment
  variables).
- The `getDashboards()` method returns the raw dashboard data directly from Isracard, before
  normalization.

---

## 🤝 Contributing

We welcome feedback, issues, and contributions. If you’d like to help migrate additional scrapers or
improve the architecture, feel free to open a pull request or discussion.

---

## 📝 License

> _(Insert license info here if applicable)_

---

Want me to help polish the Installation section or add a Usage example too?
