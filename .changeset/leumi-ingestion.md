---
'@accounter/server': minor
'@accounter/scraper-app': minor
---

Store Bank Leumi data. Three new upload mutations (`uploadLeumiIlsTransactions`,
`uploadLeumiForeignTransactions`, `uploadLeumiCreditCardTransactions`) write to new raw tables, and
each row becomes a charge and transaction, as for the other banks. The scraper app gains a Bank
Leumi source: it signs in, reads the shekel account, the foreign-currency accounts and the bank's
own credit cards, and uploads them after the discovered accounts and cards are approved.
