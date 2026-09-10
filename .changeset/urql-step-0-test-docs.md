---
'@accounter/client': patch
---

Correct the Testing section of `packages/client/CLAUDE.md`.

It claimed the package uses jsdom. The vitest `client` project sets `environment: 'happy-dom'`
(`vitest.config.ts`), and happy-dom is the package's devDependency — jsdom is not installed at all.

Also records two things that are easy to lose an afternoon to: the package has no
`@testing-library`, so tests render by hand with `createRoot` + `act`; and `yarn generate` must run
before `yarn test:client`, because `src/gql/` is git-ignored and 16 of the 46 test files fail to
resolve their generated documents without it.

Documentation only.
