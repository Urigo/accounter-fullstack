---
'@accounter/client': patch
---

Replace Mantine's display primitives — `Text`, `Group`, `ThemeIcon`, `Mark`, `Progress` and the last
`Loader` — with plain Tailwind and shadcn equivalents, clearing Mantine from six files.

These have no state or behaviour, so each is a direct markup substitution rather than a component
swap:

- `Text` → `<div>` with `text-xs` / `text-sm`. Mantine v6's `Text` renders a `div`, not a `span`, so
  the replacement keeps it block-level — using a `span` would have run the tag name and its path
  together on one line in the tag cells.
- `Group` → `flex items-center gap-4`.
- `ThemeIcon radius="xl" size="xl"` → an `inline-flex size-11 … rounded-full` span. Mantine's `xl`
  size is 44px, which is `size-11`.
- `Mark` → the native `<mark>` element with an explicit `bg-green-200` / `bg-red-200`.
- `Progress` → `ui/progress.tsx`. Mantine's version renders its own `label`; the shadcn one does
  not, so the percentage is now a sibling `span`.

Files cleared: `charges/cells/{tags,type}.tsx`, `charge-matches/cells/{tags,type}.tsx`,
`business-ledger/business-ledger-single.tsx`, `charges-ledger-validation.tsx`. That makes
`components/charge-matches` Mantine-free, so it joins the ESLint rule's `error` list.

Mantine imports: 101 → 95, across 94 → 88 files.
