---
'@accounter/client': patch
'@accounter/server': patch
---

- **Client Creation Flow Enhancement**: The "Create New Business" dialog now includes an option to
  immediately create a client associated with the new business. If selected, a `ModifyClientDialog`
  will automatically open after business creation, streamlining the onboarding process.
- **`ModifyClientDialog` Flexibility**: The `ModifyClientDialog` component has been enhanced with a
  `showTrigger` prop, allowing it to be rendered without its default trigger button, making it
  suitable for programmatic opening. It also now consistently calls the `onDone` callback when
  closed, improving callback reliability.
- **User Navigation Improvements**: The user dropdown menu now displays the actual logged-in
  username from the `UserContext` and includes a direct link to the "Admin Configurations" page for
  the user's primary business, providing quicker access to administrative settings.
- **Form Schema Refinements**: The business creation form schema has been updated to use more direct
  Zod validators (`z.email()`, `z.url()`) for better type safety and includes a new `isClient`
  boolean field to indicate if the business is also a client.
