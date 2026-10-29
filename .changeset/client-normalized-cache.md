---
'@accounter/client': patch
---

The client now has a normalized cache (`@urql/exchange-graphcache`) in the slot its exchange chain
reserved for one. Queries paint from the cache and always revalidate (`cache-and-network` is the new
default). Charge mutation results patch the charges they return in place, deleted and merged-away
charges are dropped from the cache, and mutations that generate charges refetch the cached charge
lists. A charge whose type changes (`updateCharge` with `type` or `businessTripID`, a merge, or a
derived type) stays one cached entity and every view follows the new type. Ledger records are kept
embedded, because validation differences reuse the ids of the stored records. Switching business
scope or logging out discards the cache along with the client. The route loaders and the charges CSV
export ask for fresh data explicitly.
