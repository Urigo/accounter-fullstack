---
'@accounter/server': minor
---

Provider integrations can record the business that represents the provider in the books: a new
`provider_credentials.business_id` column, exposed as `providerCredentials.businessId`, set via an
optional `businessId` argument of `setDeelCredentials` or the new `setProviderBusiness` mutation.
A migration backfills the Deel business that was hard-coded on the server, for the tenant that owns
it.
