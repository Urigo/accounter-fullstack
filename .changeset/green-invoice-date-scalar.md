---
'@accounter/green-invoice-graphql': minor
---

Type the Green Invoice `Date` scalar as a `yyyy-mm-dd` string pattern
(`` `${number}-${number}-${number}` ``) instead of `string`, matching the server's
`TimelessDateString`, so document dates need no type assertion downstream.
