---
'@accounter/client': patch
---

The shadcn/ui components under `components/ui/` are synced with the current upstream registry
(`shadcn@4.21.0`, `new-york` style), keeping this project's adjustments: the `z-1001` layering
above the MUI shell, the `container` prop on popover/select/tooltip content, `popper` as the select
default, the self-providing `Tooltip`, the dropdown label's `section` variant, the drawer's
`withOverlay` prop, button-based pagination links, the carousel's indicators and the existing card
spacing. New upstream API is available too (button `xs`/`icon-*` sizes, `ghost`/`link` badges,
`sm` switch, `line` tabs, alert-dialog `size`/`AlertDialogMedia`, avatar badge/group, popover
header/title/description). Visible upstream changes include pill-shaped badges, the grid alert
layout, lucide toast icons and a lighter skeleton.
