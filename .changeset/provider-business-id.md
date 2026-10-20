---
'@accounter/server': minor
---

Provider integrations can record the business that represents the provider in the books: a new
`provider_credentials.business_id` column, exposed as `providerCredentials.businessId`, set via an
optional `businessId` argument of `setDeelCredentials` or the new `setProviderBusiness` mutation.
The column starts empty — set it per workspace in the Deel integration settings.
