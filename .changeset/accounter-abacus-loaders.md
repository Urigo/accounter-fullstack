---
'@accounter/client': patch
---

Replace the loading spinner with the animated Accounter logo — an abacus whose beads slide along
their rods.

It ships in two shapes, both from `components/ui/accounter-spinner.tsx`, because a loader has to fit
the hole it sits in. `AccounterSpinner` is the full abacus, for slots that are roughly square: a
whole route, a dialog, a card. `AccounterBarSpinner` is the same idea flattened to one rod with three
beads (10:3), for slots that are wide and short: an overlay over a table, a full-width panel, a
placeholder where a row of data is about to appear. Each of the ~35 page, table and panel loaders
moved to whichever shape matches its container, and the full-screen loader now shows the animated
logo on its own rather than a static wordmark above a spinning `Loader2`.

Both take their colour from `currentColor` and resize with the usual utilities. The motion is SMIL
rather than CSS, so the same markup also animates when the standalone assets
(`public/icons/accounter-loader.svg` and `accounter-loader-bar.svg`) are used outside React. SMIL
ignores `prefers-reduced-motion`, so the components drop the `animateTransform` elements and render
the beads at rest when that is set.

The drawing is not a straight copy of the logo: each frame post is now a single pill-shaped `rect`
instead of a bar, two circles and a white masking rectangle stacked on top. The geometry is
identical, but nothing paints white any more, so a loader no longer assumes the surface behind it is
white.

Inline spinners inside buttons and table cells stay on lucide's `Spinner` — the abacus is unreadable
below ~40px. One of them was wrong before this change: the print-to-PDF icon button rendered a 40px
spinner inside a 30px button, and now uses the 20px one that matches its `Printer` icon.
