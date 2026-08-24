---
'@accounter/client': patch
---

Activate the shadcn colour tokens, which have been compiling to nothing since the Tailwind v4
migration.

`components.json` declared `cssVariables: false` and pointed `tailwind.config.cjs` — a file that does
not exist anywhere in the monorepo. It was deleted during the v3 → v4 migration and the theme layer
was never ported to v4's CSS-first `@theme`, so `--color-card`, `--color-muted-foreground`,
`--color-destructive` and the rest were never registered and Tailwind never generated the utilities
that reference them. Roughly 380 usages across ~100 files were inert: `text-muted-foreground`,
`bg-card`, `border-border` and `text-destructive` each emitted **zero** rules into the bundle, so
secondary text rendered as full-strength body colour, `bg-muted`/`bg-accent`/`bg-card` were
transparent, and error text rendered black instead of red.

`src/index.css` now defines the full token set in `@theme` on shadcn's `gray` base, with `.dark`
overrides in `@layer base`. Values are literal `oklch()` rather than `var(--color-gray-500)`
references, because Tailwind v4 only emits the default palette variables it sees used — referencing
one that happens to be unused elsewhere would resolve to nothing. Tokens that stood in for an
existing default were given that default's value, so classes which were previously no-ops stay
visually unchanged: `--color-background`/`--color-card` are white (already the page background),
`--color-foreground` is gray-950 (already the inherited text colour), and `--color-border` is gray-200
to match the `border-color` compatibility rule already in the base layer. The visible changes are the
genuinely broken cases — muted text now reads gray-500, `text-destructive` reads red-600, and
`bg-muted`/`bg-accent`/`bg-secondary` gain their light tint.

Also fixes `business/client/charts-section.tsx`, which set its axis ticks with
`hsl(var(--muted-foreground))`. That is v3 syntax: the v4 token is `--color-muted-foreground` and
holds a colour rather than an HSL triplet, so the `hsl()` wrapper produced an invalid value and the
ticks fell back to Recharts' default. Its `hsl(var(--chart-N))` siblings are correct and unchanged —
the `--chart-*` family really is stored as triplets.

Dark mode remains inert: `next-themes` is installed but no `ThemeProvider` is mounted, so nothing ever
puts `.dark` on an ancestor. The overrides are defined so the ~425 `dark:` utilities already in the
codebase are correct when that switch is eventually wired.
