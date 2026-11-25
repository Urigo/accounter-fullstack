---
'@accounter/client': minor
---

Add the form 1214 report page (`/reports/1214?year=`, "Form 1214 Report" in the side menu). It
reports on the active business for a tax year chosen among the years form 1214 supports (the URL's
year, else the latest): the validation errors and warnings grouped by the report field they are
about, with each rule ID and spec reference and a link to the section to fix; the shareholders,
company details, required declarations, related companies, R&D investments and record 1000 amounts
the report is built from, read-only for now; and a button that downloads the file for SHAAM once
the report has no errors. The annual audit's step 18 now opens this page for the audited year and
is marked done by hand, and step 6's "Manage Shareholders" opens its shareholders section.
