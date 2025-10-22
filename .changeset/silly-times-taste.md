---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Admin Business Configuration Tab**: Introduced a dedicated "Admin" tab within the business
  details page to manage administrative financial information.
- **Frontend Component Development**: A new `AdminBusinessSection` React component was created,
  featuring a form for various tax and registration details, with client-side validation using `zod`
  and `react-hook-form`.
- **GraphQL API Extension**: New GraphQL types (`CreateAdminBusinessInput`,
  `UpdateAdminBusinessInput`) and mutations (`createAdminBusiness`, `updateAdminBusiness`,
  `deleteAdminBusiness`) were added to the backend to support the management of admin business data.
- **Data Fetching and Update Logic**: A new `useUpdateAdminBusiness` hook was implemented on the
  frontend to interact with the new GraphQL mutations, handling data submission and user feedback.
- **Backend Resolver Implementation**: Server-side resolvers were updated to expose administrative
  business fields and handle the logic for fetching and updating this data.
