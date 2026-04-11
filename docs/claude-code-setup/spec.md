# Claude Code Setup — Specification

> **Status**: Ready for implementation **Last updated**: 2026-04-06

## 1. Overview

Add Claude Code configuration to the `accounter-fullstack` monorepo so that any developer can launch
`claude` in the repo root and immediately be productive — with correct build commands, coding
conventions, and permission guardrails pre-configured.

### Current State

| What exists            | Location                                                           |
| ---------------------- | ------------------------------------------------------------------ |
| Cursor rules (3 files) | `.cursor/rules/components.mdc`, `graphql.mdc`, `packages.mdc`      |
| Claude local settings  | `.claude/settings.local.json` (personal bash permission overrides) |

Nothing else: no `CLAUDE.md`, no `.claude/rules/`, no shared `settings.json`, no skills, hooks,
commands, or subagents.

### Target State

```
accounter-fullstack/
├── CLAUDE.md                                    # Root instructions (100–150 lines)
├── .claude/
│   ├── settings.json                            # Team-shared, harness-enforced permissions
│   ├── settings.local.json                      # Personal overrides (existing, git-ignored)
│   ├── rules/
│   │   ├── client-components.md                 # Path-scoped → packages/client/**/*.tsx
│   │   ├── graphql-server.md                    # Path-scoped → packages/server/src/modules/**
│   │   └── migrations.md                        # Path-scoped → packages/migrations/**
│   ├── commands/
│   │   ├── generate.md                          # /generate — run codegen
│   │   ├── test-module.md                       # /test-module <name> — test one server module
│   │   └── new-module.md                        # /new-module <name> — scaffold GraphQL module
│   ├── skills/
│   │   └── fix-issue/
│   │       └── SKILL.md                         # Fix a GitHub issue end-to-end (manual invoke)
│   └── agents/
│       ├── code-reviewer.md                     # Codebase-aware review agent
│       └── schema-analyzer.md                   # GraphQL schema change analysis
├── packages/
│   ├── server/
│   │   ├── CLAUDE.md                            # Server-specific conventions
│   │   └── .claude/skills/graphql-module/
│   │       ├── SKILL.md                         # GraphQL module domain knowledge
│   │       └── references/                      # Example files for progressive disclosure
│   └── client/
│       └── CLAUDE.md                            # Client-specific conventions
└── .cursor/rules/                               # Keep as-is for Cursor users
```

---

## 2. Repository Context

| Property         | Value                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| Package manager  | yarn 4.13.0 (Yarn Berry, PnP)                                             |
| Node version     | 24.14.1                                                                   |
| Monorepo tool    | yarn workspaces (no Nx/Turbo)                                             |
| Package count    | 18 packages under `packages/`                                             |
| Key packages     | `server` (GraphQL API), `client` (React SPA), `migrations` (Postgres DDL) |
| Server framework | GraphQL Modules + graphql-codegen + Postgres                              |
| Client framework | React + Vite + urql + shadcn/ui + Tailwind                                |
| Test runner      | Vitest (unit, integration, demo-seed projects)                            |
| Linter           | ESLint (flat config) + Prettier                                           |
| CI               | GitHub Actions                                                            |

### Essential Commands

These **must** appear in the root `CLAUDE.md` so Claude can execute them without asking follow-up
questions:

```bash
yarn install            # Install all dependencies
yarn generate           # Run GraphQL + SQL codegen (concurrent)
yarn generate:watch     # Watch mode for codegen
yarn build              # Full build (generate → tools → main)
yarn lint               # ESLint across the repo
yarn prettier:check     # Prettier check
yarn prettier:fix       # Prettier auto-fix
yarn test               # Unit tests (vitest)
yarn test:integration   # Unit + integration tests
yarn local:setup        # Docker + DB init + codegen
yarn seed:admin-context # Seed admin context for server
```

---

## 3. Phase 1 — Root `CLAUDE.md`

**File**: `CLAUDE.md` (repo root) **Committed**: Yes **Size target**: 100–150 lines (well under the
200-line adherence threshold)

### Content Requirements

The root `CLAUDE.md` must include these sections:

#### 3.1 Imports

```markdown
@README.md @package.json
```

These give Claude access to the project overview and all available scripts without bloating the
CLAUDE.md itself.

#### 3.2 Package Manager

```markdown
# Package Manager

- ALWAYS use `yarn`. NEVER use npm, npx, or pnpm.
- To add a dependency: `yarn workspace <package-name> add <dep>`
- To add a root dev dependency: `yarn add -D <dep> -W`
- To run a workspace script: `yarn workspace <package-name> <script>`
```

#### 3.3 Monorepo Structure

Brief (not file-by-file) overview of the 18 packages grouped by role:

- **Core**: `server` (GraphQL API), `client` (React SPA), `migrations` (Postgres DDL/DML)
- **Scrapers**: `modern-poalim-scraper`, `etana-scraper`, `etherscan-scraper`, `kraken-scraper`,
  `israeli-vat-scraper`
- **Integrations**: `green-invoice-graphql`, `hashavshevet-mesh`, `payper-mesh`, `deel` (via server
  app-providers)
- **Generators**: `pcn874-generator`, `opcn1214-generator`, `shaam6111-generator`,
  `shaam-uniform-format-generator`
- **Tools**: `gmail-listener`, `scraper-local-app`
- **Deprecated**: `old-accounter` (excluded from workspaces)

#### 3.4 Build & Test Commands

List the essential commands from Section 2 above.

#### 3.5 Code Generation

```markdown
# Code Generation

- Run `yarn generate` after changing any GraphQL schema (typeDefs files) or SQL schema.
- Codegen is concurrent: GraphQL (graphql-codegen) and SQL run in parallel.
- Generated files are git-ignored: `__generated__/`, `gql/`, `schema.graphql`.
- NEVER manually edit generated files.
```

#### 3.6 Architecture Decisions

Brief notes on:

- **GraphQL Modules**: server uses `graphql-modules` for modular schema. Each module in
  `packages/server/src/modules/<name>/` has its own typeDefs, resolvers, and providers.
- **Dependency Injection**: providers use `@Injectable()` decorator. Access via
  `context.injector.get(ProviderClass)` in resolvers.
- **Database**: Postgres accessed through provider classes, never directly from resolvers.
- **Client**: React + urql for GraphQL, shadcn/ui components, Tailwind CSS.
- **Type safety**: end-to-end via graphql-codegen — schema → server types → client types.

#### 3.7 Coding Conventions

- ES modules (`import`/`export`), never CommonJS (`require`)
- All imports use `.js` extension suffix (ESM convention)
- TypeScript strict mode

#### 3.8 Git & PR Conventions

- Small, focused PRs
- Squash merge
- Run `yarn lint` and `yarn generate` before committing

### What to Exclude from Root `CLAUDE.md`

- File-by-file descriptions
- Standard TypeScript/JavaScript conventions Claude already knows
- Long tutorials or explanations
- Anything that changes frequently
- Package-specific details (those go in package-level `CLAUDE.md`)

---

## 4. Phase 2 — Path-Scoped Rules (`.claude/rules/`)

Rules with YAML `paths` frontmatter that only load when Claude works with matching files.

### 4.1 `client-components.md`

**File**: `.claude/rules/client-components.md`

```yaml
---
paths:
  - 'packages/client/src/components/**/*.tsx'
  - 'packages/client/src/components/**/*.ts'
---
```

Migrate content from `.cursor/rules/components.mdc`:

- shadcn/ui component imports (from `./ui/...`)
- Tailwind class preferences (core utilities over arbitrary values)
- Form patterns (`react-hook-form` + `zod` + shadcn `Form`)
- Error/loading state patterns (`Loader2`, `Alert`)
- GraphQL integration (`useQuery`, `useMutation` from urql)
- Dialog component patterns
- Memoization and callback patterns

### 4.2 `graphql-server.md`

**File**: `.claude/rules/graphql-server.md`

```yaml
---
paths:
  - 'packages/server/src/modules/**/*.ts'
---
```

Migrate content from `.cursor/rules/graphql.mdc`:

- Module structure: typeDefs (`gql` tag), resolvers (query/mutation/field), providers
  (`@Injectable()`)
- Resolver signature: `(parent, args, { injector }) => ...`
- Provider access: `injector.get(ProviderClass)` — never instantiate directly
- Type generation: import from `__generated__/types`
- GraphQL naming: PascalCase types, camelCase fields, ALL_CAPS enums
- Input type conventions
- Error handling (union types with `CommonError`)

### 4.3 `migrations.md`

**File**: `.claude/rules/migrations.md`

```yaml
---
paths:
  - 'packages/migrations/**'
---
```

New content (no Cursor source):

- Migration files go in `packages/migrations/src/`
- SQL migrations must be idempotent where possible
- Always include both up and down migrations
- Never modify an existing migration that has been deployed
- Test migrations locally with `yarn local:setup` before committing

---

## 5. Phase 3 — Package-Level `CLAUDE.md` Files

These are loaded on-demand when Claude reads files in the package directory. They are NOT loaded at
session start.

### 5.1 `packages/server/CLAUDE.md`

**Size target**: 60–80 lines

Content:

- **Module structure**: each module in `src/modules/<name>/` contains:
  - `typeDefs/*.graphql.ts` — schema definitions using `gql` tag
  - `resolvers/` — query, mutation, and field resolvers
  - `providers/*.provider.ts` — data access layer (`@Injectable()`)
  - `index.ts` — module registration via `createModule()`
- **33 existing modules** (list the names for reference)
- **Provider patterns**: constructor injection of `DatabaseService`, DataLoader patterns for N+1
  prevention
- **Resolver patterns**: always destructure `{ injector }` from context, get providers via
  `injector.get()`
- **Testing**: `yarn test` for unit tests, `yarn test:integration` for integration. Server tests use
  injector-based setup.
- **Server-specific commands**: `yarn workspace @accounter/server build`, `yarn seed:admin-context`
- **Auth**: modules under `src/modules/auth/` handle authentication/authorization

### 5.2 `packages/client/CLAUDE.md`

**Size target**: 40–60 lines

Content:

- **Stack**: React + Vite + urql + shadcn/ui + Tailwind
- **Directory structure**: `components/`, `hooks/`, `providers/`, `router/`, `graphql/`, `helpers/`,
  `lib/`
- **GraphQL**: operations defined in `src/graphql/`, types generated to `src/gql/` (git-ignored)
- **Component conventions**: functional components, named exports, `ReactElement` return type
- **UI library**: shadcn/ui components in `src/components/ui/`, import from `./ui/<component>.js`
- **Dev server**: `yarn workspace @accounter/client dev` → Vite dev server
- **Build**: `yarn workspace @accounter/client build` → production build
- **Testing**: client tests in `src/__tests__/`, uses jsdom environment

---

## 6. Phase 4 — Shared Settings (`.claude/settings.json`)

**File**: `.claude/settings.json` **Committed**: Yes (team-shared)

This file enforces behavior **deterministically** via the Claude Code harness — unlike `CLAUDE.md`
which is advisory.

### Settings Precedence (highest to lowest)

1. Command-line flags
2. `.claude/settings.local.json` (personal, git-ignored)
3. `.claude/settings.json` (team-shared, committed)
4. `~/.claude/settings.json` (user global)

### Content

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(yarn *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git status *)",
      "Bash(git commit *)",
      "Bash(git add *)",
      "Bash(git checkout *)",
      "Bash(git branch *)",
      "Bash(node *)",
      "Bash(tsx *)",
      "Bash(cat *)",
      "Bash(find *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(wc *)",
      "Bash(grep *)",
      "Bash(ls *)",
      "Bash(mkdir *)",
      "Bash(echo *)",
      "Bash(yarn graphql-codegen *)",
      "Edit(packages/**)",
      "Edit(CLAUDE.md)",
      "Edit(.claude/**)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)",
      "Bash(git reset --hard *)",
      "Bash(yarn npm publish *)"
    ]
  }
}
```

### Notes

- **Wildcard syntax** (`Bash(yarn *)`) allows any yarn subcommand without individual permission
  prompts.
- **`deny` rules cannot be overridden** by lower-priority allow rules — this is a safety net.
- The existing `.claude/settings.local.json` continues to hold personal overrides (e.g.,
  machine-specific find paths). It remains git-ignored.

---

## 7. Phase 5 — Slash Commands (`.claude/commands/`)

Commands are prompt templates invoked via `/command-name`. They inject into the existing context
(unlike skills which can fork context).

### 7.1 `/generate`

**File**: `.claude/commands/generate.md`

```markdown
Run the code generation pipeline and verify it completes successfully.

1. Run `yarn generate`
2. If it fails, read the error output and fix the underlying issue
3. After successful generation, run `yarn lint` on any files that changed
4. Report what was generated and any issues found
```

### 7.2 `/test-module`

**File**: `.claude/commands/test-module.md`

```markdown
Run tests for the server module: $ARGUMENTS

1. Find the module under `packages/server/src/modules/$ARGUMENTS/`
2. Run `vitest run` targeting test files in that module
3. If tests fail, analyze the failure and suggest fixes
4. If no tests exist, note that and offer to create them
```

### 7.3 `/new-module`

**File**: `.claude/commands/new-module.md`

```markdown
Scaffold a new GraphQL module named: $ARGUMENTS

1. Look at existing modules under `packages/server/src/modules/` for the current patterns
2. Create the module directory: `packages/server/src/modules/$ARGUMENTS/`
3. Create these files following existing patterns:
   - `typeDefs/$ARGUMENTS.graphql.ts` — GraphQL type definitions using `gql` tag
   - `resolvers/index.ts` — resolver map
   - `providers/$ARGUMENTS.provider.ts` — data provider with `@Injectable()`
   - `index.ts` — module registration with `createModule()`
4. Register the module in the application's module list
5. Run `yarn generate` to update types
6. Run `yarn lint` to verify
```

---

## 8. Phase 6 — Package-Level Skills

Skills provide domain knowledge with progressive disclosure. They are **folders** containing
`SKILL.md` and optional reference material.

### Key Design Principles (from Claude Code team — Thariq, Boris)

- **Description is a trigger**: write it for the model ("when should I fire?"), not as a human
  summary
- **Don't state the obvious**: focus on what pushes Claude out of its default behavior
- **Don't railroad Claude**: give goals and constraints, not prescriptive step-by-step
- **Include Gotchas section**: highest-signal content — add failure points over time
- **Use `references/` subdirectories**: for progressive disclosure of examples

### 8.1 Server: GraphQL Module Skill

**Location**: `packages/server/.claude/skills/graphql-module/`

```
graphql-module/
├── SKILL.md
└── references/
    ├── example-provider.ts      # Annotated example provider
    ├── example-resolver.ts      # Annotated example resolver
    └── example-typedefs.ts      # Annotated example typeDefs
```

**`SKILL.md`**:

```yaml
---
name: graphql-module
description:
  When creating, modifying, or debugging GraphQL modules, resolvers, providers, or type definitions
  in the server package
---
```

Body should cover:

- Module anatomy (typeDefs → resolvers → providers → module registration)
- Provider injection patterns specific to this codebase
- DataLoader usage for N+1 prevention
- How field resolvers chain to child providers
- Common resolver signature: `async (parent, args, { injector }) => ...`
- Type generation: types come from `__generated__/types`, never hand-written
- **Gotchas**:
  - Always import with `.js` extension
  - Never access DB directly from resolvers — use providers
  - Generated types are in `__generated__/` which is git-ignored — run `yarn generate` first
  - Provider classes must have `@Injectable()` decorator or DI fails silently
  - (Add more as discovered)

**`references/`**: copy and annotate a representative example from an existing simple module (e.g.,
`sort-codes` or `tags`). Strip business logic, keep structure. Add inline comments explaining "why"
for non-obvious patterns.

### 8.2 Root: Fix Issue Skill

**Location**: `.claude/skills/fix-issue/SKILL.md`

```yaml
---
name: fix-issue
description: Fix a GitHub issue end-to-end — from reading the issue to creating a PR
disable-model-invocation: true
---
```

Body:

```markdown
Fix the GitHub issue: $ARGUMENTS

1. Run `gh issue view $ARGUMENTS` to get full issue details
2. Understand the problem and identify affected files
3. Search the codebase for relevant code
4. Implement the fix
5. Run `yarn generate` if any GraphQL or SQL schema changed
6. Run `yarn test` to verify no regressions
7. Run `yarn lint` to verify code style
8. Create a descriptive commit: `git commit -m "fix: <description> (closes #$ARGUMENTS)"`
9. Push and create a PR: `gh pr create --fill`
```

`disable-model-invocation: true` ensures this only runs when explicitly invoked via
`/fix-issue <number>`.

---

## 9. Phase 7 — Subagents (`.claude/agents/`)

Subagents run in isolated context with their own tool permissions and model selection.

### 9.1 Code Reviewer

**File**: `.claude/agents/code-reviewer.md`

```yaml
---
name: code-reviewer
description: Reviews code changes for codebase-specific patterns, conventions, and potential issues
tools: Read, Grep, Glob, Bash
model: sonnet
---
```

Body:

```markdown
You are a senior engineer reviewing code in the accounter-fullstack monorepo.

Review for:

- Correct use of dependency injection (injector.get(), @Injectable())
- Database access only through providers, never directly in resolvers
- Proper error handling with union types (CommonError pattern)
- Missing `yarn generate` after schema changes
- Import paths using .js extension
- N+1 query risks (missing DataLoader usage)
- Security: no secrets in code, proper input validation

Provide specific line references and suggested fixes.
```

### 9.2 Schema Analyzer

**File**: `.claude/agents/schema-analyzer.md`

```yaml
---
name: schema-analyzer
description:
  Analyzes GraphQL schema changes for breaking changes, migration needs, and downstream impact
tools: Read, Grep, Glob, Bash
---
```

Body:

```markdown
You are a GraphQL schema expert analyzing changes in the accounter-fullstack monorepo.

When analyzing schema changes:

1. Run `yarn generate` to ensure types are current
2. Identify breaking vs non-breaking changes
3. Check client usage of modified types/fields via grep in packages/client/
4. Check if database migrations are needed for new/changed fields
5. Identify downstream resolvers and providers affected
6. Report: what changed, what breaks, what needs migration, what clients are affected
```

---

## 10. Phase 8 — Hooks (Post-Baseline)

Hooks run deterministically outside the agentic loop. Add these **after** the team has baseline
experience with Claude Code.

### 10.1 PostToolUse: Auto-Format

Run prettier after Claude edits files, handling the last 10% of formatting to prevent CI failures.

```jsonc
// In .claude/settings.json, add:
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "yarn prettier --write $FILE_PATH 2>/dev/null || true"
      }
    ]
  }
}
```

### 10.2 Stop: Verification Nudge

Nudge Claude to verify before completing a turn.

```jsonc
{
  "hooks": {
    "Stop": [
      {
        "command": "echo 'Reminder: run yarn generate (if schema changed) and yarn lint before finishing.'"
      }
    ]
  }
}
```

> **Note**: Hook syntax may evolve. Verify against current Claude Code docs before implementing.
> These are lower priority and should be added iteratively.

---

## 11. Phase 9 — Git Hygiene

### 11.1 `.gitignore` Updates

Add to `.gitignore`:

```
CLAUDE.local.md
```

### 11.2 Files to Commit

All new files in a single PR:

| File                                                         | Committed?                 |
| ------------------------------------------------------------ | -------------------------- |
| `CLAUDE.md`                                                  | Yes                        |
| `packages/server/CLAUDE.md`                                  | Yes                        |
| `packages/client/CLAUDE.md`                                  | Yes                        |
| `.claude/settings.json`                                      | Yes                        |
| `.claude/rules/client-components.md`                         | Yes                        |
| `.claude/rules/graphql-server.md`                            | Yes                        |
| `.claude/rules/migrations.md`                                | Yes                        |
| `.claude/commands/generate.md`                               | Yes                        |
| `.claude/commands/test-module.md`                            | Yes                        |
| `.claude/commands/new-module.md`                             | Yes                        |
| `.claude/skills/fix-issue/SKILL.md`                          | Yes                        |
| `packages/server/.claude/skills/graphql-module/SKILL.md`     | Yes                        |
| `packages/server/.claude/skills/graphql-module/references/*` | Yes                        |
| `.claude/agents/code-reviewer.md`                            | Yes                        |
| `.claude/agents/schema-analyzer.md`                          | Yes                        |
| `.gitignore` (modified)                                      | Yes                        |
| `.claude/settings.local.json`                                | No (git-ignored, personal) |
| `CLAUDE.local.md`                                            | No (git-ignored, personal) |
| `.cursor/rules/*`                                            | Keep as-is (no changes)    |

---

## 12. Implementation Order

Phases are ordered by dependency and value. Phases 1–4 are **essential** and should be done first.
Phases 5–8 are **progressive enhancement**.

| Phase | What                      | Priority      | Dependencies                 |
| ----- | ------------------------- | ------------- | ---------------------------- |
| 1     | Root `CLAUDE.md`          | **Must have** | None                         |
| 2     | `.claude/rules/`          | **Must have** | None (parallel with Phase 1) |
| 3     | Package-level `CLAUDE.md` | **Must have** | None (parallel with Phase 1) |
| 4     | `.claude/settings.json`   | **Must have** | None (parallel with Phase 1) |
| 5     | Slash commands            | Should have   | Phase 1 (for conventions)    |
| 6     | Package-level skills      | Should have   | Phase 3 (server CLAUDE.md)   |
| 7     | Subagents                 | Nice to have  | Phase 1                      |
| 8     | Hooks                     | Nice to have  | Phases 1–4 + team experience |
| 9     | Git hygiene               | **Must have** | All above                    |

---

## 13. Verification Checklist

After implementation, verify:

- [ ] **First-try test**: launch `claude` at repo root, type "run the tests" — it must execute
      `yarn test` without asking follow-up questions
- [ ] **`/memory`**: shows root `CLAUDE.md`, all `.claude/rules/` files, and `settings.json` loaded
- [ ] **Server context**: edit a file in `packages/server/src/modules/` →
      `packages/server/CLAUDE.md` loads on-demand AND graphql-module skill description appears
- [ ] **Client context**: edit a `.tsx` in `packages/client/src/components/` →
      `packages/client/CLAUDE.md` loads AND `client-components` rule triggers
- [ ] **`/context`**: no warnings about excluded skills or character budget overflow
- [ ] **Slash commands**: `/generate`, `/test-module charges`, `/new-module example` all execute
      correctly
- [ ] **Permissions**: `yarn test`, `yarn lint`, `git diff` run without permission prompts; `rm -rf`
      is blocked
- [ ] **Subagent**: "use the code-reviewer agent to review this file" spawns isolated review
- [ ] **Cursor coexistence**: `.cursor/rules/` still present and functional for Cursor users

---

## 14. Design Decisions & Rationale

| Decision                                                  | Rationale                                                                                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root CLAUDE.md at 100–150 lines                           | Adherence drops with longer files. 200 is the official ceiling; staying well under it ensures Claude consistently follows instructions.                                                                 |
| Settings for enforcement, CLAUDE.md for behavior          | `settings.json` `deny` rules are harness-enforced and cannot be overridden. CLAUDE.md instructions are advisory — don't rely on CLAUDE.md for critical safety rules.                                    |
| Package-level skills in `packages/<name>/.claude/skills/` | Claude's skill discovery walks DOWN into subdirectories on-demand (not up like CLAUDE.md). Package-level placement ensures skills load only when working in that package, keeping other contexts clean. |
| Skills are folders with `references/` subdirs             | Progressive disclosure — Claude reads the SKILL.md first (lightweight), only pulls reference files when it needs specific examples. Saves context tokens.                                               |
| Commands for daily workflows, skills for domain knowledge | Commands inject into existing context (simple, fast). Skills support context forking and progressive disclosure (better for complex domain knowledge). Use the right tool for the job.                  |
| Keep `.cursor/rules/` alongside `.claude/rules/`          | Team members may use both tools. Content will drift over time, but maintaining both is better than forcing a single tool. Consolidate later if one wins.                                                |
| Migrate, don't copy-paste Cursor rules                    | Claude's format (markdown + YAML `paths` frontmatter) differs from Cursor's `.mdc` format. Adapt content to fit the new format properly.                                                                |
| Start vanilla, add complexity progressively               | Over-engineering the setup causes more confusion than it solves. Phases 1–4 deliver 80% of the value. Add skills/hooks/agents after the team has baseline experience.                                   |

---

## 15. Future Considerations

### MCP Servers (`.mcp.json`)

If the team adopts external tool integrations (Sentry, Linear, Slack), adding an `.mcp.json` at the
repo root connects Claude to those tools. Not needed for initial setup.

### Skill Character Budget

Default budget for skill descriptions is 15,000 characters. As you add more skills, monitor with
`/context` for warnings about excluded skills. Increase via `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var
if needed.

### Auto Memory

Enabled by default, personal to each developer (stored at `~/.claude/projects/<hash>/memory/`). No
setup needed. Periodically run `/memory` to audit what Claude has learned about the codebase and
prune incorrect learnings.

### Agent Teams

For large features, consider agent teams (multiple Claude sessions coordinating via shared tasks).
Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings. Evaluate after the team is
comfortable with single-agent usage.

### Shared Source of Truth

If both Cursor and Claude Code remain in use long-term, consider creating an `AGENTS.md` file that
both tools import to avoid instruction drift between `.cursor/rules/` and `.claude/rules/`.
