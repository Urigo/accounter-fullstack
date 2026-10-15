---
'@accounter/server': minor
'@accounter/client': patch
---

Foreign-securities ledgers now book withheld tax to a local or a foreign tax category, by the
issuer's country (as the income line already does): `SecuritiesTaxCategoryKey`
`DIVIDEND_WITHHOLDING_TAX` and `BOND_WITHHOLDING_TAX` are replaced by
`FOREIGN_`/`LOCAL_DIVIDEND_WITHHOLDING_TAX` and `FOREIGN_`/`LOCAL_BOND_WITHHOLDING_TAX`. A migration
moves the tax category already set for each to its foreign key; the local ones start unset and are
asked for from the charge's ledger errors. Stored ledger records are not changed — regenerating a
charge's ledger suggests the new split.
