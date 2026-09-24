---
'@accounter/client': major
---

Remove Mantine from the client. `@mantine/core`, `@mantine/hooks`, `@mantine/dropzone` and
`@mantine/carousel` are uninstalled, `MantineProvider` is gone from the root layout, and the
`font-family`, `line-height` and body colours that its global styles used to supply are now set
explicitly — in `index.css`, and on the MUI theme's `CssBaseline` overrides, which is the rule that
wins in the app. `dayjs` goes with it — it was only there for `@mantine/dates`.
