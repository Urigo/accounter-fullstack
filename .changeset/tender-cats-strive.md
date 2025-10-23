---
'@accounter/client': patch
'@accounter/server': patch
---

- **Businesses Screen UI Overhaul**: The main businesses listing screen has been completely
  redesigned, transitioning from a traditional table layout to a modern, card-like display for
  improved aesthetics and user experience.
- **New BusinessHeader Component**: A dedicated `BusinessHeader` component was introduced to
  standardize the display of business information, including dynamic status (Active/Inactive) and
  role (Admin/Client) badges.
- **Enhanced Business Navigation**: Each business entry in the list is now clickable, allowing
  direct navigation to its detailed page, and includes integrated checkboxes for selection,
  enhancing interactivity.
- **Refactored New Business Form**: The 'Insert Business' modal has been significantly refactored,
  incorporating Zod for robust validation and organizing the form into distinct, user-friendly
  sections for contact information, default settings, and auto-matching configurations.
- **Simplified Business Insertion Logic**: The backend `insertBusiness` resolver was updated to
  streamline the process of adding new businesses, specifically by simplifying the handling of tax
  category insertions.
