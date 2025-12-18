---
'@accounter/client': patch
---

- **Type Safety and State Management**: Enhanced type safety and state management within the
  document generation and preview components, including the use of `as const` and refined
  `useEffect` dependencies for object comparisons.
- **Improved User Experience for Country Selection**: Upgraded the country selection input in client
  forms from a standard `Select` component to a more interactive `ComboBox`, improving usability and
  search capabilities.
- **ComboBox Component Refinement**: Refactored the `ComboBox` component for better semantic clarity
  by renaming types and variables, and added a visual `ChevronDownIcon` to its trigger for improved
  user feedback.
- **Client Data Synchronization**: Implemented a new `useEffect` hook to ensure the
  `selectedClientId` state accurately reflects changes in `formData.client?.id`, improving data
  consistency.
