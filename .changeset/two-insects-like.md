---
'@accounter/client': patch
---

- **Auth0 Integration**: The UserNav component now directly integrates with Auth0 to fetch user
  authentication status and profile information.
- **Enhanced User Profile Display**: The user menu dynamically displays the user's avatar image,
  falls back to initials if no image is present, and shows the user's email and role within the
  dropdown.
