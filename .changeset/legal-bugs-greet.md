---
'@accounter/client': patch
---

- **Dependency Consolidation**: Replaced numerous individual `@radix-ui/react-*` packages with a single `radix-ui` package in `package.json` and `yarn.lock`. Updated import statements across various UI component files to use the consolidated `radix-ui` package instead of individual `@radix-ui/react-*` imports.
