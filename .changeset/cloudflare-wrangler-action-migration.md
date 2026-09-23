---
'@accounter/client': patch
---

Fix the Cloudflare Pages deploy by migrating off the removed `cloudflare/pages-action`.

Cloudflare deprecated and then deleted the `cloudflare/pages-action` repository, so the runner can no
longer resolve the action and the `Publish Client to Cloudflare Pages` job fails during
`Prepare all required actions`, before any step runs. The pinned SHA does not help: an action is
resolved by repository first, and that repository is gone.

The publish step now uses `cloudflare/wrangler-action` running `wrangler pages deploy`, and
`wrangler` is pinned as an exact devDependency of the client so the action reuses the workspace
installation instead of installing one into a Yarn Berry workspace during CI.
