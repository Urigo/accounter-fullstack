---
'@accounter/client': patch
'@accounter/server': patch
---

- **Claude Code Configuration**: Added comprehensive configuration for Claude Code, including root
  instructions, path-scoped rules, and team-shared settings to ensure consistent behavior across the
  monorepo.
- **Domain-Specific Skills and Agents**: Implemented custom skills for issue fixing and GraphQL
  module management, along with specialized agents for code review and schema analysis to improve
  developer productivity.
- **Package-Level Conventions**: Introduced package-specific CLAUDE.md files for server and client
  packages to provide targeted guidance on architecture, testing, and development workflows.
- **Slash Commands**: Added slash commands for common tasks like scaffolding new GraphQL modules,
  running code generation, and executing module-specific tests.
