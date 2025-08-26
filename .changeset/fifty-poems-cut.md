---
'@accounter/client': patch
---

- **Improved 404 Handling**: A dedicated `PageNotFound` component has been created to provide a
  consistent and user-friendly experience when users navigate to non-existent URLs.
- **Dedicated Network Error Page**: A new `NetworkError` component has been introduced to clearly
  inform users about connectivity issues with the server, guiding them to check their internet
  connection.
- **Centralized 404 Routing**: The application's routing has been updated to utilize the new
  `PageNotFound` component for all unmatched routes, centralizing 404 display logic.
- **Proactive Network Error Redirection**: The `urql` provider now includes enhanced error handling
  that detects network-related errors and automatically redirects the user to the new `NetworkError`
  page, preventing generic error displays.
- **Robust Error Property Access**: Optional chaining has been applied to error property access
  within the `urql` provider's authentication error checks, making the code more resilient to
  unexpected error structures.
