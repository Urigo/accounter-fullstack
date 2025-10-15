---
'@accounter/server': patch
---

- **HTML to PDF Conversion**: The method for converting HTML content has been upgraded from
  generating PNG images using `node-html-to-image` to producing high-fidelity PDF documents using
  `puppeteer`. This change significantly improves the quality and format of generated documents.
- **Dependency Management**: The project dependencies have been updated to reflect the new
  conversion mechanism. `node-html-to-image` was removed, and new packages including `puppeteer`,
  `handlebars`, and `inline-css` were added to facilitate the enhanced PDF generation.
- **Improved Error Handling**: Error messages within the `GmailServiceProvider` have been refined to
  provide more specific and actionable information, aiding in debugging and troubleshooting document
  processing failures.
