---
'@accounter/client': patch
---

Clear both warnings from the client build, one of which was pointing at a real regression.

`vite.config.ts` used `__dirname`, which does not exist under `configLoader: 'native'` — the loader
Vite plans to make the default, since it loads the config as real ESM. Replaced with
`import.meta.dirname`.

The chunk-size warning turned out to be worth chasing. Attributing the built bundle back to its
sources showed the initial page load pulling **3933 kB of JS across 23 preloaded chunks**, because
three heavy dependencies were reachable from the eagerly-rendered layout:

- `layout/user-nav.tsx` — always mounted, it is the header — imported `ConfirmationModal`,
  `LogoutButton`, `SyncDocumentsModal` and `Tooltip` from the `components/common` barrel. That
  barrel re-exports `buttons/`, `modals/` and `documents/`, so those four small components dragged
  the entire barrel graph — pdfjs-dist, jsPDF, pako, html2canvas — into a 1452 kB shared chunk that
  was `modulepreload`ed on first paint. Now deep imports, as is the barrel import in
  `common/modals/balance-charge-modal.tsx`.
- `common/modals/uniform-format-files-modal.tsx` imported `iconv-lite` at module scope purely to
  encode a file the user has to click for, pulling iconv plus the `readable-stream` / `buffer` /
  `util` / `string_decoder` polyfills into the entry chunk. Now imported on demand.
- `common/buttons/print-to-pdf-button.tsx` and `common/documents/issue-document/pdf-viewer.tsx`
  imported `react-to-pdf` and `pdfjs-dist` statically although both only run on user action. Now
  dynamically imported; `pdf-viewer` merges its worker-setup and document-load effects and guards
  the resolved document against an unmounted component.

Entry chunk 710 kB → 357 kB, the shared `common` chunk 1452 kB → 298 kB, and total eager JS
3933 kB → 2150 kB. jsPDF (651 kB), pdf.js (457 kB) and iconv (355 kB) moved to on-demand chunks that
never reach the initial load.

Two chunks still exceed Vite's 500 kB default, so `build.chunkSizeWarningLimit` is set to 900 with a
comment recording why — low enough to still flag a genuine regression:

- the generated GraphQL documents, 820 kB raw but 47 kB gzipped, since document ASTs compress about
  17:1. It is a single generated module and cannot be split; shrinking it means moving codegen to
  `documentMode: 'string'`, which trades bundle size for runtime GraphQL parsing.
- the lazy jsPDF + html2canvas bundle, 651 kB, which no longer loads up front.

`user-menu.test.tsx` mocked the barrel module, so its mocks were repointed at the same deep paths.
