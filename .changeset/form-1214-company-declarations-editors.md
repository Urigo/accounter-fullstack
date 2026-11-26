---
'@accounter/client': minor
---

The form 1214 report page (`/reports/1214`) can now edit the year's company details, preparer and
declarations:

- **Company details**: overrides for the registered name, phone and fax (an allowed prefix and a
  7-digit number), email, occupation, the mailing, business and books addresses and the withholding
  file number. An empty field keeps the value from the books.
- **Report preparer**: office, contact person, name, profession, licensed dealer number, address and
  phone. Clearing every field removes the preparer.
- **Declarations**: the 7 required yes/no questions (Yes / No / Not answered), the optional yes/no
  questions and flags, the form 6111 obligation and consolidated report selects, the family company,
  beneficiary enterprise and special year details, and the reportable positions (more than the
  form's 5 can be saved; the report validation flags them). The reportable positions show only
  while declaration 1030 (the company took a reportable position) is answered yes; otherwise they
  are not checked, and saving the declarations clears them.

Each editor saves its own block, shows the server's message when a save is rejected, and refreshes
the report's validation after saving.
