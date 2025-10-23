---
'@accounter/client': patch
---

- **Centralized Error Handling**: Implemented a centralized approach to handle GraphQL network and
  operation errors within the URQL client configuration, ensuring consistent error feedback across
  the application.
- **User-Friendly Notifications**: Integrated the `sonner` toast library to display clear and
  concise toast notifications for network connectivity issues and general GraphQL operation
  failures, improving the user experience.
- **Refined Data Loader Logic**: Simplified data loaders by removing generic GraphQL error checks,
  allowing them to focus on specific application-level errors (e.g., 404 Not Found) that should
  trigger error boundaries, while other errors are handled by the new toast system.
- **Authentication Error Prioritization**: Ensured that authentication-related GraphQL errors (e.g.,
  `FORBIDDEN`) continue to trigger navigation to the login page, with these errors explicitly
  skipped by the new toast notification system to avoid redundant alerts.
