---
'@accounter/client': patch
---

- **Centralized Logout Logic**: Introduced a new `useLogout` custom React hook to centralize the logout functionality, making it reusable and testable. The `useLogout` hook now handles clearing `sessionStorage`, (preparation for) resetting the URQL client store, and initiating the Auth0 logout process with a specified return URL.
