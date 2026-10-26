---
'@accounter/server': minor
---

Provider integrations can record the business that represents the provider in the books: a new
`provider_credentials.business_id` column, exposed as `providerCredentials.businessId` and
`providerCredentials.business`, set via an optional `businessId` argument of `setDeelCredentials` or
the new `setProviderBusiness` mutation (`null` clears it). The business must belong to the
workspace. The column starts empty — set it per workspace in the Deel integration settings.
Changing only the business no longer moves the credentials' `configuredAt`.
