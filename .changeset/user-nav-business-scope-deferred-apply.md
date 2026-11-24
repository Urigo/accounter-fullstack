---
'@accounter/client': patch
---

The business scope picker in the user menu no longer closes the menu on every business toggle. The
selection is applied once, when the picker or the menu closes, and only if it changed, so selecting
several businesses takes one data refresh instead of one per click. `MultiSelect` gains an optional
`onOpenChange` callback.
