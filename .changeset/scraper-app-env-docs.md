---
'@accounter/scraper-app': patch
---

README: documents every environment variable the app reads (`PORT`, plus `NODE_DEBUG` for
puppeteer), notes that the app loads no `.env` file and that no secret belongs in a `VITE_`
variable, and fixes the workspace name in the commands (`@accounter/scraper-app`), the production
run path (`dist/server/index.js`) and the required Node.js version.
