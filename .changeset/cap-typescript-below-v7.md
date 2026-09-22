---
---

Cap `typescript` below v7 in Renovate, and pin `target` / `esModuleInterop` in the three standalone
scraper tsconfigs so those options no longer ride on compiler defaults that TypeScript 7 changes.

No package release: the three affected packages are private, and only build configuration changed.
