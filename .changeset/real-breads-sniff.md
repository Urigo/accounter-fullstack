---
'@accounter/client': patch
---

- **Centralized Routing**: Introduced a new `ROUTES` object to centralize and standardize all
  application routing, replacing numerous ad-hoc URL construction functions and hardcoded paths.
- **Removed Redundant Functions**: Eliminated several `getHref` and `encodeFilters` utility
  functions across various components, simplifying the codebase and reducing duplication.
- **Improved Navigation Consistency**: Updated `Link` components and navigation calls to
  consistently use the new `ROUTES` object, ensuring a uniform approach to client-side routing.
- **Enhanced UX for Table Rows**: Modified table rows in `BusinessExtendedInfo` to make the entire
  row clickable for navigation to charge detail pages, improving user experience.
