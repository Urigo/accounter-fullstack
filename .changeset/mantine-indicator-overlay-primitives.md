---
'@accounter/client': patch
---

Replace Mantine's `Indicator`, `Overlay`, `LoadingOverlay`, `SimpleGrid`, `Loader` and `Image` with
local Tailwind primitives — the first component cluster of the Mantine removal.

Two new primitives fill genuine gaps in shadcn's catalogue and live in `components/ui/` as
first-class components rather than compatibility shims:

- `ui/indicator.tsx` — the status dot used on table cells and filter buttons. Mantine's usage was
  near-identical at all 21 call sites (`inline`, `size`, `disabled`, `color`, `processing`), so the
  swap was mechanical. Mantine's `processing` ripple becomes `animate-pulse`; the `zIndex="auto"`
  plumbing every call site carried is dropped, as the new dot needs no stacking override.
- `ui/overlay.tsx` — `Overlay` and `LoadingOverlay`, the scrim veiling a form while a mutation runs.
  Mantine's default appearance was a 60% white wash, matched here so this is not also a visual
  change. `LoadingOverlay`'s prop is now `blur` rather than `overlayBlur`.

Four wrappers were reimplemented in Tailwind, so their consumers were untouched:

- `common/simple-grid.tsx` — Mantine v6's `breakpoints` array is max-width based (desktop-first)
  while Tailwind's variants are min-width based, so the ladder is inverted rather than translated.
  Mantine's own thresholds are kept (≤600 → 1, 601–900 → 2, 901–980 → 3, >980 → `cols`) via
  arbitrary `min-[…]` variants, so this is not also a layout change. One deliberate difference:
  Mantine applied those breakpoints regardless of `cols`, so a `cols={1}` grid still rendered 3
  columns between 901px and 980px; each tier is now capped at `cols`. Column classes are spelled
  out per count because Tailwind only emits utilities it finds as literals. The three files that
  imported Mantine's `SimpleGrid` directly rather than through this wrapper now use it too, so
  Mantine's grid is gone entirely.
- `common/loaders/loader.tsx` — Mantine's `variant="dots"` loader has no lucide equivalent, so
  `AccounterLoader` now uses the house `Spinner`. **This is a deliberate, visible change** to the
  full-page loading animation.
- `common/icon.tsx` — Mantine `Image` becomes a plain `<img>`, and now carries an `alt`.
- `common/divider.tsx` — deleted. `AccounterDivider` had no consumers anywhere.

Also adds stories for both new primitives.

Mantine imports: 124 → 102, across 117 → 95 files.
