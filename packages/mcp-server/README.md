# @accounter/mcp-server

Remote MCP (Model Context Protocol) server that exposes a curated, **read-only** subset of Accounter
capabilities to Claude clients (Claude.ai / Claude Desktop).

See the design docs:

- [`docs/mcp/spec.md`](../../docs/mcp/spec.md) — connector specification
- [`docs/mcp/implementation-blueprint.md`](../../docs/mcp/implementation-blueprint.md) — incremental
  implementation plan

## Status

Early scaffolding. This package is being built incrementally following the prompt pack in the
implementation blueprint. It currently contains only the package skeleton (no runtime behavior yet).

## Scripts

```bash
yarn workspace @accounter/mcp-server build     # tsc → dist/
yarn workspace @accounter/mcp-server dev       # run entrypoint with tsx (watch)
yarn workspace @accounter/mcp-server lint      # eslint
yarn workspace @accounter/mcp-server test      # vitest (package-scoped)
yarn workspace @accounter/mcp-server typecheck # tsc --noEmit
```
