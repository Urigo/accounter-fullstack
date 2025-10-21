---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Business/Client Page**: Introduced a comprehensive new page for businesses and clients,
  consolidating various details into a single, tabbed interface for improved management and
  overview.
- **Modular UI Components**: Developed several new UI components (`BusinessHeader`,
  `ChargesSection`, `ChartsSection`, `ConfigurationsSection`, `ContactInfoSection`,
  `ContractsSection`, `DocumentsSection`, `IntegrationsSection`) to structure and display different
  aspects of business information.
- **Dynamic Routing and Tab Navigation**: Implemented dynamic routing for the new business page
  (`/businesses/:businessId`) and integrated tab-based navigation to switch between different
  sections like contact info, configurations, and analytics.
- **Business Configuration Form**: Added a detailed configuration form allowing users to manage VAT
  settings, tax exemptions, default sort codes, tax categories, IRS codes, and auto-matching rules
  for bank transactions and documents (phrases, emails, attachment types).
- **Backend GraphQL Enhancements**: Extended GraphQL types for `Business`, `FinancialEntity`, and
  `TaxCategory` to include `createdAt` and `updatedAt` fields, providing essential timestamp
  information.
- **UI Library Integration**: Integrated the `@radix-ui/react-progress` component and refactored the
  `pcn874RecordType` enum definition into a shared helper for better code organization.
