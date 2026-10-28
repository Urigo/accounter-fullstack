---
'@accounter/client': patch
---

Leave the app's chrome (header, sidebar, footer, breadcrumbs, toasts) out of printed pages, and
print on A4 with a 12mm margin. A page that prints a document of its own can also leave its title
row out (`PageLayout`'s `hideHeaderInPrint`) and name the PDF (`usePrintDocumentTitle`).
