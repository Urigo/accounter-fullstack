---
'@accounter/server': minor
'@accounter/client': minor
---

Look up Israeli businesses in the Corporations Authority registry. A new
`IsraeliCorporationsRegistryClient` app-provider wraps the public ica.justice.gov.il company search
(cached for an hour, hits and misses alike), exposed as
`israeliCorporation(corporationNumber: String!): IsraeliCorporation` — null when the registry doesn't
list the number.

When a business's country is Israel, the create-business dialog and the business contact section
check the government ID as it is typed: a check-digit mismatch is flagged without a lookup, and a
valid number shows a compact card with the company's Hebrew and English names, status, type,
registration date, last annual report and registered address, plus a "Fill empty fields" button
that copies the Hebrew name, address, city and zip code into the form. A number the registry
doesn't list (sole proprietors, partnerships, non-profits) or a failed lookup only shows a notice
and never blocks saving.

The create-business dialog now actually requires the local name and government ID for Israeli
businesses — the check compared the country to `'Israel'` instead of `'ISR'` and never ran — and
reports each missing field under its own input.
