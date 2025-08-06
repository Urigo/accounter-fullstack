---
'@accounter/client': patch
'@accounter/server': patch
---

*   **Client Form Refactoring**: The client form (`client-form.tsx`) has been updated to use GraphQL fragments for client data, introducing a `normalizeClientInfo` utility for consistent data transformation. It now includes a `fetching` state to provide better loading feedback.
*   **Income Form Enhancements**: The income form (`income-form.tsx`) has been reorganized to improve layout and data input, including the addition of currency selection and reordering of fields. Some previously included fields like 'Catalog Number' have been commented out or removed from the data structure.
*   **Main Document Issuance Form Logic**: The central `GenerateDocument` component (`index.tsx`) now dynamically fetches client information using `urql`'s `useQuery` hook, allowing for pre-population of client details. Several sections related to description, footer text, discount, rounding, and digital signature have been temporarily commented out in the UI.
*   **Payment Form Modularity**: The payment form (`payment-form.tsx`) has been refactored to generalize account and transaction input fields using a `useCallback` hook, and payment type-specific fields (e.g., for wire transfers, cheques, PayPal, and other payment apps) are now conditionally rendered for better clarity.
*   **Backend Data Handling**: On the server-side, new helper functions have been introduced (`issue-document.helper.ts`) to deduce VAT types, retrieve linked document attributes, determine document dates from transactions, and fetch detailed client information from Green Invoice. The GraphQL schema (`green-invoice.graphql.ts`) and resolvers (`green-invoice.resolvers.ts`) have been updated to reflect these new data structures and logic, including the removal of redundant fields from `GreenInvoiceIncome`.
*   **Document Naming Conventions**: Minor textual updates have been made to document names (e.g., "Proforma" to "Proforma Invoice") for improved clarity.
