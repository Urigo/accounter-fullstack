---
'@accounter/client': patch
---

Move the four loading states that were still on lucide's `Spinner` onto the Accounter abacus
loaders, so every page-, dialog- and panel-level loader in the client matches the convention.

Each one moves to the shape that fits its slot. The charge extended-info panel is a full-width
placeholder where a stack of accordions is about to appear, so it takes `AccounterBarSpinner`; the
tags route and the tag dialog both centre their loader above a "Loading tags..." line in a roughly
square hole, so they take `AccounterSpinner`. The overlay veiling the add-depreciation-record form
was an `Overlay` with a spinner hand-placed inside it — exactly what `LoadingOverlay` already is, so
it now uses that instead.

Inline spinners inside buttons, next to file inputs and in table cells are unchanged: the abacus is
unreadable below ~40px, and lucide's `Spinner` stays the right tool there.
