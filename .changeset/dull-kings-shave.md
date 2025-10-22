---
'@accounter/client': patch
---

- **React Router v6 Migration**: The application's navigation has been significantly refactored to
  leverage React Router v6's declarative API, replacing `useMatch` with `useParams` and standard
  `<a>` tags with `<Link>` components for improved client-side routing and performance.
- **Centralized Route Management**: All application routes are now defined in a single, type-safe
  `ROUTES` object, enhancing maintainability and ensuring consistency across navigation links. The
  router configuration has been moved to an object-based structure, enabling advanced features like
  loaders and error boundaries.
- **Enhanced User Experience**: New features include a global error boundary for graceful handling
  of routing errors (e.g., 404, 401, 500), a navigation progress indicator for smoother transitions
  between pages, dynamic document titles, and a breadcrumbs component to improve user orientation
  within the application.
- **Data Prefetching with Loaders**: Route loaders have been introduced to prefetch necessary data
  (e.g., business and charge details) before components render, leading to faster perceived page
  loads. Authentication and authorization checks are also integrated into these loaders.
- **Refactored Button Components**: Legacy `Button` and `ButtonWithLabel` components have been
  removed and replaced with a unified `ui/button.js` component, standardizing button styling and
  behavior across the application.
- **Dedicated URQL Client for Loaders**: A new singleton URQL client (`urql-client.ts`) has been
  implemented specifically for use within route loaders, ensuring data fetching in loaders is
  independent of React's context system.
