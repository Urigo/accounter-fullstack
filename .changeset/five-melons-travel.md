---
'@accounter/server': patch
---

- **Auth0 Management Service Enhancements**: The Auth0ManagementService now includes new
  functionalities for user management, such as unblocking users and initiating password reset
  emails.
- **User Creation Flow Adjustment**: The `createUser` method has been renamed to `createBlockedUser`
  to explicitly reflect that newly created users are initially blocked, aligning with an
  invitation-based registration process.
- **Dependency Injection for Environment**: The service now uses dependency injection for
  environment variables, improving testability and modularity.
