---
'@accounter/client': patch
'@accounter/server': patch
---

- **Database Schema Refactor**: The `businesses_admin` table is updated to replace single-value
  fields for tax and social security identifiers with array-based JSONB columns, allowing for
  multiple annual IDs and historical tax rates.
- **GraphQL Schema Update**: The GraphQL `AdminBusiness` type and related input types
  (`CreateAdminBusinessInput`, `UpdateAdminBusinessInput`) are modified to reflect the new array
  structures, introducing `AnnualId` and `TaxAdvancesRate` types.
- **Frontend Form Overhaul**: The `admin-business-section.tsx` component is refactored to use
  `react-hook-form`'s `useFieldArray` for dynamic management of annual IDs and tax rates, providing
  a more flexible user interface.
- **Backend Logic Adaptation**: New Zod schemas and resolver logic are implemented on the server to
  validate and process the updated array-based data for admin business updates.
