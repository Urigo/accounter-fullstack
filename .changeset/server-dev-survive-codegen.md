---
'@accounter/server': patch
---

Keep `yarn server:dev` running when a rebuild fails while `yarn generate:watch` regenerates types.

`tsc` exits with code 2 on type errors, which nodemon reserves for a malformed `--exec` command when
it happens within 500 ms of the last watched file event. Codegen writing `__generated__` files
mid-build hit that window, so nodemon stopped instead of waiting for the next change. The `--exec`
command now ends in `|| exit 1`, turning such failures into an ordinary crash that the pending
restart recovers from.
