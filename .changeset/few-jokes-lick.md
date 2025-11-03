---
'@accounter/server': patch
---

- **Puppeteer Replacement**: This PR replaces Puppeteer with Playwright for generating PDFs from
  HTML in the `gmail-service.provider.ts` file.
- **Dependency Updates**: The PR adds `playwright` as a dependency to `packages/server/package.json`
  and removes Puppeteer configurations.
