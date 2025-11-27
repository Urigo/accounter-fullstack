---
'@accounter/server': patch
---

- **Centralized DB Pool Management**: The application now utilizes a single PostgreSQL connection
  pool, initialized at startup and shared across the entire server, replacing individual client
  instantiations.
- **Dependency Injection for Database Access**: The database connection pool is now injected into
  the GraphQL application context and passed explicitly to modules and plugins, promoting a cleaner
  and more consistent approach to database interactions.
- **Graceful Shutdown Implementation**: New logic has been added to ensure the server and database
  pool shut down gracefully upon receiving termination signals (e.g., SIGINT, SIGTERM) or
  encountering critical errors, allowing in-flight requests to complete.
- **Enhanced Error Handling**: The centralized connection pool includes error handling that triggers
  a graceful shutdown for database-related issues, unhandled promise rejections, and uncaught
  exceptions, improving application stability.
