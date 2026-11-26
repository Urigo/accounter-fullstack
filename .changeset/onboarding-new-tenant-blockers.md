---
'@accounter/server': patch
'@accounter/client': patch
---

Fix two things that stopped a newly created business from being set up in the app:

- The admin business registration date was saved to one column and read from another, so it could
  never be set, and a business without one (or without a tax ID) lost its Accounts and Admin tabs,
  including the form where the date is entered. `AdminBusiness.governmentId` and
  `AdminBusiness.registrationDate` are now nullable instead of failing the whole record, and
  `updateAdminBusiness` writes the column that is read.
- A bank account could be created without a bank number and branch number. It was stored, but could
  not be listed afterwards, and hid every other account of the business with it. The server now
  refuses it and the form asks for both numbers.
