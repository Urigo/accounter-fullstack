---
'@accounter/client': patch
---

Record two testing gotchas in `packages/client/CLAUDE.md`, both found the hard way during the urql
quick-wins sequence.

**A green `yarn test:client` does not mean the package builds.** `build` is `tsc && vite build`, and
`tsc` type-checks the tests that vitest runs happily — an untyped `vi.fn()` factory makes
`.mock.calls[0][0]` an empty tuple, which vitest ignores and `tsc` rejects. Worse, the failing `tsc`
skips `vite build` silently, so a stale `dist` stays on disk and anything inspecting the bundle reads
the previous build's output.

**A green run does not prove a test still exists.** A restack dropped an entire feature commit; the
suite stayed green because the commit's tests were dropped with it, and 19 passing quietly became 17
passing.

Documentation only.
