---
'@accounter/mcp-server': minor
---

New write tool `accounter_update_business`: edit an existing business (address, city, zip, country,
phone, website, contact email, government id, tax category, sort/IRS codes, flags and matching
suggestions) through upstream `updateBusiness`, so a model can fill in a vendor's details from its
invoice without the UI.
