---
'@accounter/client': patch
'@accounter/server': patch
---

- **New GraphQL Scalar for Country Codes**: A new GraphQL scalar type, `CountryCode`, has been
  introduced to represent country codes. This scalar includes validation to ensure that all country
  codes conform to the ISO 3166-1 alpha-3 standard.
- **Centralized CountryCode Enum**: The `CountryCode` enum definition has been moved from
  `packages/server/src/modules/countries/types.ts` to a shared location at
  `packages/server/src/shared/enums.ts`. This centralizes the enum, making it accessible across
  different modules and ensuring consistency.
- **GraphQL Schema and Resolver Updates**: The GraphQL schema and various resolvers have been
  updated to utilize the new `CountryCode` scalar and the shared enum. This includes changes in
  `business-trips`, `countries`, and `financial-entities` modules to correctly handle country code
  types.
- **Client-Side Component Adjustments**: Client-side components, specifically
  `contact-info-section.tsx` and `accommodations-row.tsx`, have been modified to correctly query and
  display country information, adapting to the new structured `Country` type and `CountryCode`
  scalar.
