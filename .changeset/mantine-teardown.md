---
'@accounter/client': major
---

Remove Mantine from the client. `@mantine/core`, `@mantine/hooks`, `@mantine/dropzone` and
`@mantine/carousel` are uninstalled, `MantineProvider` is gone from the root layout, and the
`font-family`, `line-height` and body colours its global styles supplied are now set explicitly in
`index.css`. `dayjs` goes with it — it was only there for `@mantine/dates`.
