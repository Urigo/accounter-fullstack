---
'@accounter/server': patch
---

- **Environment Variable Cleanup**: Removed hardcoded and auto-generated environment variables like
  DEFAULT_FINANCIAL_ENTITY_ID and Gmail credentials from the main configuration, promoting a cleaner
  and more secure setup.
- **OpenTelemetry Integration**: Added comprehensive OpenTelemetry configuration settings to the
  environment template to support better observability and tracing.
- **Configuration Loading Improvements**: Updated various packages to support loading environment
  variables from both local and parent directory files, improving flexibility across different
  environments.
- **Removal of Legacy Helpers**: Removed the writeEnvVar helper and associated tests, as the
  automatic modification of .env files during seeding processes has been deprecated.
