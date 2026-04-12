---
name: fix-issue
description: Fix a GitHub issue end-to-end — from reading the issue to creating a PR
disable-model-invocation: true
---

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
