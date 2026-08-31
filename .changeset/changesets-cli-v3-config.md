---
---

Adjust the changesets setup for `@changesets/cli` v3: opt back into versioning private packages
(the v3 default stopped versioning them, which broke mixed changesets), point `$schema` at
`@changesets/config@4.0.0`, and wrap `changeset publish` in CI so the release action still receives
the `New tag:` lines it parses.
