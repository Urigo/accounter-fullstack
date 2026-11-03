# Document Viewer: developer spec for issue #4685

> **Status:** spec only. No code changes yet. Agreed through a question-by-question review with the
> product owner. The decisions log is final. The design definition that follows it is the UX
> baseline the decisions refine, and where they conflict the decisions log wins.
>
> Issue: #4685

## Decisions log

| #   | Topic                  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Delivery               | **Stacked PRs, value first.** PR 1 is the viewer core inside today's drawer, made wide. PR 2 adds the shared viewer and the Docked column. PR 3 adds the Embedded split in the edit sheet. PR 4 adds the Overlay for mobile and above modals. PR 5 adds the Should items: stepper, Save & next, rotate, shortcuts, persisted sizes and the live image-URL preview. Download was dropped (decision 15). Each PR ships on its own.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2   | Zoom engine            | **Native scroll, built in-house, no new dependency.** The image is sized by `natural size × zoom` inside an `overflow: auto` box. Zoom keeps the point under the cursor fixed by adjusting `scrollLeft/scrollTop`. Drag-to-pan moves the scroll position. **Trackpad pinch must zoom:** handle `wheel` with `ctrlKey` (Chrome, Edge and Firefox report pinch this way) through a non-passive listener that calls `preventDefault` so the browser page doesn't zoom. Handle Safari's `gesturestart/gesturechange/gestureend` (`event.scale`). Two-finger trackpad scroll stays native panning. Touch pinch uses two-pointer distance via Pointer Events. Normalize `deltaMode` (Firefox line mode) before applying the zoom factor.                                                                                                                                                              |
| 3   | PR 1 shell             | **Widened vaul drawer.** Add a `size` option to `PopUpDrawer` (`common/modals/drawer.tsx`) so this drawer is `w-full` under `sm` and half the viewport with a 420px minimum from `sm` up. Other drawers keep the house width. The viewer canvas carries `data-vaul-no-drag` so drags pan instead of closing. The focus trap stays as it is today (vaul 1.1.2 ignores `modal={false}`, see `providers/portal-container.ts`). It goes away when PR 2 and PR 3 retire the drawer.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | Magnifier              | **Kept as an opt-in toggle, off by default**, in PR 1. One Small/Medium/Large size control replaces today's duplicate icon pairs. It is rebuilt on the new canvas, magnifying 2.5× the displayed image, and follows zoom and rotation. Hidden on touch-only devices (`(hover: none)`). It is suspended while a drag-pan is in progress. `ImageMagnifier` (`common/image-magnifier.tsx`) is deleted, since `DocumentImageDrawer` is its only user.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | Image source           | **Load the stored `image` URL unchanged.** No Cloudinary URL rewriting and no change to load time or transformation usage. Nearly every preview is a Cloudinary JPG from `CloudinaryProvider.uploadInvoiceToCloudinary` (upload helper, email ingestion, Deel, Green Invoice), but the edit form accepts any URL, so the viewer must not assume a host. Display-optimized and higher-density renders are deferred to the later multi-page PDF work.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6   | Viewer input           | **Plain props plus a title helper; no GraphQL inside the viewer.** `type DocumentViewerSource = { imageUrl: string \| null; fileUrl: string \| null; title: string; subtitle?: string }`, with URL inputs accepting `string \| URL` and normalized with `toString()`. A new `getDocumentViewerLabels({ documentType, serialNumber, creditor, debtor })` in `helpers/documents.ts` returns e.g. `{ title: 'Tax Invoice 1042', subtitle: 'Acme Ltd → Your Company Ltd' }`. It reuses `getDocumentNameFromType`, but that helper **throws** on unknown types, so the new one catches the error and falls back to `'Document'`. A missing serial or party is simply omitted. The table fragment (`TableDocumentsRowFields`) and the `EditDocument` query already select every field needed, so **no query changes** are required.                                                                   |
| 7   | Testing                | **Pure geometry module plus happy-dom component tests plus stories. No new infrastructure.** `viewer-geometry.ts` holds all the math: fit zoom per mode with rotation and the no-upscale cap, cursor-anchored `zoomAt`, clamping to 25–800%, pan bounds, and wheel normalization across `deltaMode`. It gets table-driven unit tests. `document-viewer.test.tsx` uses the repo's `createRoot` + `act` pattern, stubs `clientWidth`/`clientHeight`/`naturalWidth` because happy-dom has no layout, and covers event wiring, states, the toolbar and the loupe toggle. `document-viewer.stories.tsx` covers A4 portrait, landscape, a long receipt, a small image, a broken URL and no preview, and is auto-mounted by `src/__tests__/stories.test.tsx`. The PR body carries the manual QA checklist from decision 19. Run `tsc --noEmit` alongside `yarn test:client`, per the client CLAUDE.md. |
| 8   | Viewer state (PR 2)    | **A Zustand store, `hooks/use-document-viewer.ts`**, following `hooks/use-sidebar.ts`. State: `current: (DocumentViewerSource & { id: string }) \| null`. Actions: `open(source)` swaps in place and `close()`. Rows read `useDocumentViewer(s => s.current?.id === doc.id)`, so a swap re-renders only the two affected rows. Call sites need no provider, which covers dialogs and portals. The store is cleared on route change (the dashboard layout watches `location.pathname`). Tests reset it in `beforeEach`.                                                                                                                                                                                                                                                                                                                                                                          |
| 9   | Wide pages (PR 2)      | **Dock on every page; no per-page rules.** The docked column is a third flex child in `components/layout/dashboard-layout.tsx`, after the page column. It takes half the space right of the sidebar by default (the sidebar starts minimized at 72px, so about 684px each side at 1440px). Its minimum is 420px, and the page column keeps at least 480px and scrolls sideways when a table is wider, as it already does via `overflow-scroll`. If both minimums don't fit, the PR 1 drawer is the fallback until PR 4's Overlay replaces it. In PR 2 the edit sheet keeps opening the PR 1 drawer, because the vaul sheet traps focus and covers the docked column. PR 3 replaces it.                                                                                                                                                                                                          |
| 10  | Edit surface (PR 3)    | **Keep `EditDocumentModal` as the vaul bottom sheet**, consistent with the other five bottom-sheet edit modals, and grow it from `max-h-[80vh]` to about 90vh. This needs a `size` or `className` path on `PopUpDrawer`, extending decision 3. Inside, `EditDocument` becomes a two-pane split: the form on the left and the embedded viewer on the right. Each pane scrolls independently, and both carry `data-vaul-no-drag`. The viewer is inside the sheet's focus scope, so the vaul focus trap no longer blocks anything. The thumbnail column and its drawer are removed. While the sheet is open, the docked viewer from PR 2 hides (`useDocumentViewer` close, or a `suspended` flag restored on sheet close).                                                                                                                                                                         |
| 11  | After save             | **PR 3 keeps Save-and-close.** `EditDocument.onSubmit` calls `onDone()` and fires `updateDocument` in the background, as today. **PR 5 adds "Save & next"** next to Save. It **awaits** `updateDocument`, stays on the current document if the update fails (the hook already toasts the error), and on success swaps the next document of the source list into the same sheet. It is disabled on the last document and when nothing is dirty. `EditDocumentModal` gains optional `siblingIds: string[]` (source order) and `onNavigate(id)`, passed by its four openers: `documents-table/index.tsx`, `screens/documents/all-documents/index.tsx`, `documents-table/documents-gallery.tsx` and `issue-document/recent-business-docs.tsx`.                                                                                                                                                      |
| 12  | Modal detection (PR 4) | **Inspect the trigger's DOM at open time.** `open(source, { trigger })` takes the clicked element. If `trigger.closest('[role="dialog"], [role="alertdialog"]')` matches, or the viewport is under 1024px, or the docked minimums don't fit, the placement is `overlay`. Otherwise it is `docked`. The trigger is kept in a non-reactive field of the store (not rendered state) and gets focus back on close. **The overlay must be a Radix Dialog**, nested so it joins the open modal's layer stack. A body-portaled plain element would be inert, because an open Radix modal disables outside pointer events and `aria-hidden`s siblings. It renders with no backdrop, above `z-1001`. `Esc` closes only the topmost layer, which Radix handles.                                                                                                                                           |
| 13  | Back button (PR 4)     | **Back closes the full-screen phone overlay only.** Opening it calls `navigate(location, { state: { ...location.state, docViewer: true } })`. A `location.state.docViewer` that turns falsy closes the viewer. ✕ calls `navigate(-1)`, so no stale entry remains. Swapping documents while open uses `replace: true`. On load, a leftover `docViewer` flag with an empty store (a reload restores `history.state`) is cleared with a `replace`. The pathname never changes, so decision 8's clear-on-route-change does not fire. The docked column and the sheet above a modal never touch history.                                                                                                                                                                                                                                                                                             |
| 14  | Step scope (PR 5)      | **The source table, in its current sort and filter order.** Table triggers call `open(source, { trigger, siblings })`, with `siblings` built from `table.getRowModel().rows`. Cells get `table` from the TanStack cell context and type it with the `AnyTable` union from `lib/table-features.ts`, because the documents table can be paginated or not. The list is a snapshot taken at open time. If a refetch removes the current id, the stepper hides instead of guessing. Inside a charge, stepping stays within that charge's documents. On the documents report it covers the current page of up to 100 rows. Save & next (decision 11) uses the same list. Keyboard stepping follows decision 17.                                                                                                                                                                                       |
| 15  | Download               | **Dropped from scope.** The header actions are Expand, Open original and Close (Hide document in the edit sheet). Open original (`fileUrl ?? imageUrl`, `target="_blank" rel="noreferrer"`) hands off to the browser's own viewer, which already downloads and prints. This supersedes the Download entries in the design baseline below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 16  | Rollout                | **No feature flag; each PR ships to everyone on merge.** The client has no flag system. Rollback is `git revert` of the offending PR, which is clean because each stacked PR stands alone. Every PR description carries its manual QA checklist, which must pass before merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 17  | Shortcuts (PR 5)       | **Global while a viewer is open, except while typing.** One `document` `keydown` listener belongs to the **topmost active viewer**. The store keeps a stack, so the overlay beats the embedded viewer, which beats the docked one. Keys: `+`/`=` zoom in, `-` zoom out, `0` fit width, `1` 100%, `r` rotate, `m` magnifier, `[`/`]` previous/next. It skips events whose target is an `input`, `textarea`, `select` or `[contenteditable]`, or sits inside an open `[role="menu"]`, `[role="listbox"]` or `[data-radix-popper-content-wrapper]`. It also skips events with Ctrl, ⌘ or Alt held, so browser zoom and copy are untouched. `Esc` closes only when focus is inside the viewer. Tooltips show each key. This supersedes the baseline's focus-scoped shortcuts.                                                                                                                       |
| 18  | Other adopters         | **Out of this project; tracked in one follow-up issue.** The VAT monthly report thumbnails (`reports/vat-monthly-report/{income,expenses}-section/columns.tsx`) and the charge-matching detail card (`charge-matching/charge-detail-card.tsx`) keep opening the raw image in a new tab. A follow-up issue moves them to the docked viewer once PR 2 lands. In scope: the preview cell, the files cell, the actions menu, the edit sheet, and documents tables inside modals.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 19  | QA matrix              | **Manual QA on every PR:** Chrome on macOS with a trackpad, where pinch arrives as ctrl+wheel, and Windows Chrome or Edge with a notched mouse wheel. **From PR 4 on, also** iOS Safari and Android Chrome for the overlay, touch pinch, double-tap and Back. **Desktop Safari is best-effort.** Its `gesture*` handling from decision 2 stays, because it's cheap, but it is not in the QA gate. **On iOS Safari, Pointer Events drive pinch.** The `gesture*` listeners only call `preventDefault` there, to stop page zoom, and never apply `event.scale`, so the same pinch is not applied twice. Detect the case with `navigator.maxTouchPoints > 0`.                                                                                                                                                                                                                                      |

### Architect's defaults (settled without a question; low-stakes)

- **Persisted sizes** use `usePersistentState` from `hooks/use-persistent-state.ts`. The keys are
  `accounter:document-viewer:docked-ratio` and `accounter:document-viewer:edit-split-ratio`, plus
  `accounter:document-viewer:edit-pane-hidden`. Sizes are stored as a **ratio** of the available
  width (0–1), validated by a `revive` guard and clamped to the pixel minimums at render. That way
  one value works on a laptop and a 4K monitor. The hook writes `localStorage` on every state
  change, so a resize drag keeps its live width in local state and commits the ratio to the
  persisted state only on `pointerup`.
- **Stepping preloads** the next and previous siblings' images with `new Image().src`, so `]` feels
  instant. No other prefetching.
- **Safe links.** `fileUrl` and `imageUrl` are user-editable, and the `URL` scalar accepts any
  scheme. Open original therefore renders only when the URL's protocol is `http:` or `https:`, via
  an `isSafeHttpUrl` helper with unit tests. This closes a `javascript:` href risk that already
  exists in today's files cell and actions menu.
- **Module layout:** `components/common/document-viewer/` with `index.ts`, `document-viewer.tsx`
  (the core and its toolbar), `viewer-canvas.tsx`, `viewer-toolbar.tsx`, `magnifier.tsx`,
  `viewer-geometry.ts`, `use-viewer-gestures.ts`, `docked-viewer.tsx` (PR 2), `overlay-viewer.tsx`
  (PR 4), and co-located `__tests__/` and `*.stories.tsx`. `DocumentImageDrawer` is kept as a thin
  wrapper until PR 4 removes its last caller, then deleted.
- **Rotation** resets on document change and is not persisted.

## Per-PR breakdown

### Refinements from code review

The per-PR breakdown below was checked against the code. Where that check refined a decision, the
refinement applies:

- **The dialog check ships in PR 2, not PR 4** (refines decision 12). `RecentDocsOfSameType` and
  `RecentBusinessDocs` render inside the issue-document edit dialog. Without the check, PR 2 would
  dock the viewer behind that dialog's backdrop. Until PR 4, a trigger inside a dialog falls back to
  the PR 1 drawer.
- **The overlay stays at `z-1001` and sits on top through portal order** (refines decision 12). The
  viewer's own tooltips and menus portal to `document.body` at `z-1001`, so a `z-1002` overlay would
  hide them.
- **The trigger element lives in a module-level `WeakRef`, outside store state** (refines decision
  12). Before focusing it, the code checks `isConnected`.
- **The minimum zoom is `min(0.25, fitPage)`** (refines decision 7). That lets Fit page show a very
  tall receipt whole.
- **The embedded viewer gets no siblings** (refines decision 14). It has no stepper and `[`/`]` do
  nothing there, because stepping would drop unsaved edits. Save & next is the in-sheet navigation.
- **Viewer siblings skip documents with no image and no file; Save & next ids do not** (refines
  decision 14).
- **Shortcut letters, digits and brackets match on `event.code`** (refines decision 17). On a Hebrew
  keyboard layout, R types ר, M types צ and brackets are mirrored, so `event.key` would fail.

### Open questions

1. **Default docked width with the sidebar open** (acceptance criterion 1 vs decision 9). At 1440px
   with the sidebar open, half the space beside the sidebar is a 600px column. After canvas padding
   and a Windows scrollbar, the page itself is about 569px, which misses the 600px target.
   - **(a) Recommended:** default to `max(50%, 41rem)`, still capped so the page column keeps 480px.
     That is about 656px with the sidebar open, and stays 684px with it minimized.
   - **(b)** Measure criterion 1 with the sidebar minimized instead.
   - **(c)** Collapse the sidebar automatically when the viewer docks.

All paths below are relative to `packages/client/src/` unless they start with `packages/` or `/`.

---

### PR 1: Viewer core inside a wide drawer

**Goal.** Replace `ImageMagnifier` with the new `DocumentViewer` inside today's
`DocumentImageDrawer`, made wide. The viewer has a header, toolbar, canvas, states, the zoom engine
and the opt-in loupe. The four call sites keep their local `opened` state.

**Files**

- **Create** in `components/common/document-viewer/`:
  - `index.ts`, `types.ts`, `source.ts`, `viewer-geometry.ts`
  - `use-viewer-zoom.ts`: the toolbar and canvas share one zoom model, so it gets its own hook.
  - `use-viewer-gestures.ts`
  - `document-viewer.tsx` (core and header), `viewer-toolbar.tsx`, `viewer-canvas.tsx`,
    `magnifier.tsx`
  - `document-viewer.stories.tsx`
  - `__tests__/viewer-geometry.test.ts`, `__tests__/document-viewer.test.tsx`
- **Create** elsewhere:
  - `components/ui/toggle-group.tsx`: the shadcn ToggleGroup over `ToggleGroup` from `radix-ui`,
    reusing `toggleVariants` from `ui/toggle.tsx`.
  - `helpers/__tests__/documents.test.ts`
- **Modify:**
  - `helpers/documents.ts`
  - `components/common/modals/drawer.tsx`
  - `components/common/document-image-drawer.tsx`
  - `components/common/index.ts`: drop the `image-magnifier.js` export. Do not add `document-viewer`
    to this barrel, because tests partly mock it and it invites import cycles.
  - The four call sites: `documents-table/cells/preview.tsx`, `documents-table/cells/files.tsx`,
    `documents-table/document-actions-menu.tsx`, `common/forms/edit-document.tsx`.
- **Delete:** `components/common/image-magnifier.tsx`.

**Signatures**

```ts
// types.ts
export type DocumentViewerSource = {
  imageUrl: string | null;
  fileUrl: string | null;
  title: string;
  subtitle?: string;
};
export type DocumentViewerEntry = DocumentViewerSource & { id: string };
export type Rotation = 0 | 90 | 180 | 270;
export type FitMode = 'width' | 'page' | 'actual';
export type ZoomMode = FitMode | 'custom';
export type LoupeSize = 'sm' | 'md' | 'lg'; // 160 / 224 / 320 px → size-40 / size-56 / size-80
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

// helpers/documents.ts
export function getDocumentViewerLabels(input: {
  documentType?: DocumentType | null;
  serialNumber?: string | null;
  creditor?: { name: string } | null;
  debtor?: { name: string } | null;
}): { title: string; subtitle?: string };

// source.ts
export function toUrlString(v: string | URL | null | undefined): string | null; // trims, '' → null
export function toDocumentViewerEntry(
  doc: { id: string; image?: string | URL | null; file?: string | URL | null } & Parameters<
    typeof getDocumentViewerLabels
  >[0],
): DocumentViewerEntry;
export function hasViewerAttachment(s: DocumentViewerSource): boolean; // !!(imageUrl || fileUrl)
export function isSafeHttpUrl(url: string | null): boolean; // http: or https: only

// viewer-geometry.ts
export const MIN_ZOOM = 0.25, MAX_ZOOM = 8, ZOOM_STEP = 1.25, DOUBLE_CLICK_ZOOM = 2, WHEEL_LINE_PX = 16;
export function rotatedSize(natural: Size, r: Rotation): Size;
export function fitZoom(mode: FitMode, natural: Size, viewport: Size, r: Rotation): number;
export function zoomBounds(natural: Size, viewport: Size, r: Rotation): { min: number; max: number };
export function clampZoom(zoom: number, b: { min: number; max: number }): number;
export function stepZoom(zoom: number, dir: 1 | -1, b: { min: number; max: number }): number;
export function displaySize(natural: Size, zoom: number, r: Rotation): Size;
export function contentOrigin(display: Size, viewport: Size, padding: number): Point;
export function clampScroll(scroll: Point, display: Size, viewport: Size, padding: number): Point;
export function zoomAt(i: {
  natural: Size;
  rotation: Rotation;
  viewport: Size;
  padding: number;
  zoom: number;
  nextZoom: number;
  scroll: Point;
  anchor: Point;
}): Point; // next scroll
export function normalizeWheelDeltaY(e: { deltaY: number; deltaMode: number }, pageHeightPx: number): number;
export function wheelZoomFactor(deltaYPx: number): number;
export function pinchZoomFactor(prevDistance: number, nextDistance: number): number;
export function doubleClickTarget(
  s: { mode: ZoomMode; lastFit: FitMode },
  fit: number,
): { mode: ZoomMode; zoom: number };

// document-viewer.tsx (PR 2 adds onToggleExpand/expanded, PR 3 closeVariant, PR 5 stepper)
export interface DocumentViewerProps {
  source: DocumentViewerSource;
  documentKey: string;
  onClose?: () => void;
  className?: string;
}

// common/modals/drawer.tsx: new optional props
size?: 'default' | 'document'; // PR 3 adds 'tall'
withHeader?: boolean; // default true; false renders only <DrawerTitle className="sr-only">
accessibleTitle?: string; // text for that DrawerTitle (Radix requires a title)

// document-image-drawer.tsx
type Props = { source: DocumentViewerEntry | null; opened: boolean; onClose: () => void }; // null when !hasViewerAttachment
```

**Geometry rules**

- **Fit width** is `vw / rotated.w`. **Fit page** is `min(vw / rotated.w, vh / rotated.h)`. **100%**
  is 1. The viewport size is `clientWidth/clientHeight` minus 2 × padding.
- **No upscaling.** Fit width and fit page are capped at 1, which covers long receipts and small
  images.
- **Minimum zoom** is `min(0.25, fitZoom('page'))`, not 0.25. A 600×9000 receipt needs about 9% to
  show whole in Fit page (acceptance criterion 3).
- **Stepping** with +/− multiplies or divides by 1.25 and snaps to 1.0 when within 2%.
- **Wheel factor** is `clamp(exp(-d·0.01), 0.8, 1.25)`. One mouse notch equals one button step, and
  pinch deltas stay smooth.
- **Wheel normalization:** `deltaMode` 1 is multiplied by 16 and `deltaMode` 2 by the page height.
- **Origin for zoom anchoring:** x is centred when the page is narrower than the viewport; y is the
  padding (top-aligned).

**Drawer sizing**

- The `'document'` preset classes must reuse the exact prefixes from `ui/drawer.tsx`:
  `data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:w-1/2 data-[vaul-drawer-direction=right]:sm:min-w-105 data-[vaul-drawer-direction=right]:sm:max-w-none`.
  A plain `w-full` would lose twice: tailwind-merge only dedupes identical variant prefixes, and the
  attribute-variant classes have higher specificity.
- The body wrapper becomes `flex min-h-0 flex-1 flex-col` instead of `mx-auto w-full px-4 pb-4`.
  Otherwise the canvas has no definite height and cannot scroll.
- Pass vaul's `handleOnly` for this size, so vaul never touches pointer events in the viewer.
  Confirm the prop exists in the installed vaul 1.1.2 typings.

**Behaviour**

- **Header.** The title truncates, with a Tooltip showing the full text. The subtitle is muted.
  Actions are Open original (`<a href={fileUrl ?? imageUrl} target="_blank" rel="noreferrer">`,
  rendered only when `isSafeHttpUrl` passes) and ✕.
- **Toolbar.** It is sticky and contains `[−] [112%] [+]`, a ToggleGroup
  `[Fit page | Fit width | 100%]`, and a Magnifier toggle. When the magnifier is on, an `S/M/L`
  ToggleGroup appears. The toolbar is disabled until the image size is known.
- **`data-vaul-no-drag`** goes on the viewer root, not only the canvas, so the % input and the
  segmented control can't start a drawer drag.
- **Canvas structure:** a scroll box, a content wrapper, a page box, then the image.
  - Scroll box:
    `overflow-auto overscroll-contain select-none touch-none bg-gray-100 [scrollbar-gutter:stable]`,
    `tabIndex=0`, `role="group"`, `aria-label="Document image"`.
  - Content wrapper: `w-max min-w-full p-2`.
  - Page box: `relative mx-auto bg-white shadow-sm ring-1 ring-black/10`, with `width`/`height` set
    to `displaySize`.
  - Image: `absolute left-1/2 top-1/2`, size natural × zoom,
    `transform: translate(-50%,-50%) rotate(θ)`, `draggable={false}`, `decoding="async"`,
    `alt={title}`.
  - The page box is the _rotated_ bounding box, because a CSS transform alone does not change scroll
    extents.
  - Never use `justify-center` on the content wrapper: it clips the left edge once the page is wider
    than the pane.
- **Loading.** The image stays `invisible` while `<AccounterSpinner />` is centred. `onLoad` reads
  the natural size.
  - A layout effect also checks `img.complete && naturalWidth > 0` to catch cached images.
  - A natural width of 0 (some SVGs) goes to an "unsized" fallback: the image renders
    `w-full h-auto` with zoom disabled. It does not show the error state.
- **Error.** `onError` shows a destructive Alert reading "Couldn't load the document preview" with
  an Open original button.
- **No image but a file:** "No preview for this file" with Open original.
- **Neither image nor file:** "No image or file attached". Only the Embedded viewer (PR 3) can reach
  this state.
- **On load** the mode is Fit width. A `ResizeObserver` on the scroll box (guarded if missing,
  rAF-throttled) re-applies the fit mode unless the mode is `custom`; a custom zoom only re-clamps
  the scroll.
- **Applying zoom: imperative first, then mirrored into state.** `applyZoom(next, anchor)` writes
  the page and image size through refs, then sets `scrollLeft/Top` from `zoomAt`, then calls
  `setState` for the readout.
  - This keeps the cursor anchor exact even when several wheel events arrive before React commits.
  - All model values live in refs and are read only in handlers or effects, because the repo lints
    `react-hooks/refs`.
- **% readout.** It is a button; clicking it turns it into a numeric input. Enter applies the
  clamped value and switches the mode to `custom`; Esc or blur cancels.
- **Announcements.** A polite `aria-live` region says "Zoom 150%", debounced by 400ms.
- **Gestures** (`use-viewer-gestures.ts`):
  - **Wheel:** use `el.addEventListener('wheel', h, { passive: false })`. React's `onWheel` is
    passive, so it can't call `preventDefault`.
    - Act only when `ctrlKey || metaKey`: call `preventDefault`, normalize, then zoom at the cursor.
      A plain wheel stays native scrolling.
    - Ignore ctrl+wheel while a Safari gesture is active.
  - **Safari:** listen for `gesturestart`, `gesturechange` and `gestureend`.
    - Declare a local type
      `type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number }`; it is not
      in `lib.dom`.
    - Call `preventDefault` on start and change. The factor is `e.scale / lastScale`.
    - Skip gesture events while touch pointers are down, because iOS fires both (decision 19).
  - **Pointer:** primary button only, with a 3px threshold before panning starts.
    - Track the drag with `pointermove`, `pointerup` and `pointercancel` listeners on `window`, plus
      a guarded `setPointerCapture?.()`.
    - Don't end the pan on `lostpointercapture`. vaul's own `pointerdown` calls `setPointerCapture`
      on the event target, which steals capture from the canvas.
    - Never `stopPropagation` on `pointerdown`. Radix DismissableLayer would keep its "inside" flag
      set and swallow the next outside click.
    - The cursor is `cursor-grab` / `cursor-grabbing` only when the content is scrollable.
  - **Touch:** one pointer pans and two pointers pinch, anchored at the midpoint. Double-tap means
    two taps within 300ms and 24px. Mouse uses `dblclick`, which is ignored when the last pointer
    type was touch.
  - **Double-click / double-tap:** toggles between the current fit and 200% at the clicked point.
- **Magnifier.**
  - It is off by default, not persisted, and survives document swaps: its state lives in
    `DocumentViewer`, above the keyed canvas.
  - It is hidden under `useMediaQuery('(hover: none)')`, works for mouse and pen only, and is
    suspended while panning.
  - It is a `pointer-events-none` square over the viewport containing a second copy of the page box.
    The copy is drawn at `min(zoom × 2.5, MAX_ZOOM)` and translated so the cursor point is centred.
  - Scaling the rotated box means rotation needs no extra math. Position updates go through refs and
    rAF, with no React state per mouse move.
- **Labels.**
  - The title is `[typeName ?? 'Document', serial].filter(Boolean).join(' ')`.
  - The subtitle is `creditor → debtor`, or the one party that exists. Each name is wrapped in
    FSI/PDI (`⁨…⁩`) so Hebrew names don't reorder the arrow. Tests must account for those
    characters.

**Tests**

- **`viewer-geometry.test.ts`** (table-driven):
  - `rotatedSize` for all four rotations.
  - `fitZoom` for A4 2480×3508 in a 650×800 pane, landscape, a 576×4000 receipt, a 300×200 image
    (capped at 1) and a 90° rotation.
  - `zoomBounds.min` drops below 0.25 for a 600×9000 receipt.
  - `stepZoom` passes through 1.0 and clamps at both ends.
  - `zoomAt` keeps the content point under the anchor fixed, in centred, scrolled and edge-clamped
    cases.
  - `clampScroll`, `normalizeWheelDeltaY` for modes 0/1/2, the wheel and pinch factors, and
    `doubleClickTarget`.
- **`document-viewer.test.tsx`** (`IS_REACT_ACT_ENVIRONMENT = true`; stub `clientWidth/clientHeight`
  and `naturalWidth/Height` with `Object.defineProperty`; `img.dispatchEvent(new Event('load'))`
  inside `act`):
  - Spinner shows and the toolbar is disabled before load.
  - Fit width is the default image width. Fit page and 100% switch correctly.
  - +/− and the readout work, including typing 150.
  - Ctrl+wheel (`new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true })`) sets
    `defaultPrevented` and zooms in; a plain wheel is not prevented.
  - An `error` event shows the alert, and the Open original href is `fileUrl ?? imageUrl`. A
    `javascript:` URL renders no link.
  - A file without an image shows "No preview for this file".
  - The magnifier toggle reveals S/M/L, and the magnifier is hidden when
    `matchMedia('(hover: none)')` is stubbed true.
  - Changing `documentKey` resets to loading.
  - `alt` is the title, and `data-vaul-no-drag` is present.
  - A fake `ResizeObserver` (via `vi.stubGlobal`) re-applies fit.
- **`helpers/__tests__/documents.test.ts`:** full labels, no serial, no parties, one party, null
  type, and an unknown type falling back to "Document". `isSafeHttpUrl` accepts http and https and
  rejects `javascript:`, `data:` and garbage.

**Stories** (`document-viewer.stories.tsx`, frame `h-180 w-160`)

- Stories: A4Portrait, Landscape, LongReceipt, SmallImage, BrokenUrl (`/__missing__/scan.jpg`) and
  NoPreview.
- Images are inline SVG data URIs built in the file, with explicit `width`/`height` attributes so
  `naturalWidth` works in browsers. No network, no binary files.
- In happy-dom no image ever loads. The smoke test still passes because the header and toolbar
  render immediately. Don't write play functions that wait for `load`.

**Manual QA** (paste into the PR body; matrix from decision 19)

- [ ] Chrome on macOS with a trackpad: pinch zooms around the cursor and the page itself never
      zooms. Two-finger scroll pans on both axes.
- [ ] Windows Chrome or Edge with a notched mouse wheel: Ctrl+wheel zooms one step per notch around
      the cursor, and a plain wheel scrolls.
- [ ] Mouse: drag pans with the grab cursor, with no image ghost and no text selection. Double-click
      toggles fit ↔ 200% at the point.
- [ ] A4, landscape, long receipt (Fit page shows it whole) and small image (not upscaled). Nothing
      is clipped on the left at any zoom.
- [ ] Resizing the window re-applies the fit mode; a custom zoom is kept.
- [ ] Magnifier is off by default, S/M/L works, it follows zoom, and it is hidden while dragging.
- [ ] Broken URL shows the alert, and Open original works.
- [ ] All four triggers open the drawer: full width under 640px, half width (minimum 420px) above.
      The edit-charge, transaction, salary and insert-document drawers are unchanged.
- [ ] Known and expected until PR 3: in the edit sheet the drawer covers half the form.
- Best-effort, not a gate: Safari on macOS pinch (gesture events), Firefox ctrl+wheel in line mode,
  and a phone smoke check that drags never swipe the drawer closed.

**Done when.** `ImageMagnifier` is gone and the four call sites pass `source`. `yarn generate`,
`yarn test:client`, `yarn workspace @accounter/client exec tsc --noEmit` and `yarn lint` are green.
The test count went up, and the QA list is ticked.

---

### PR 2: Shared store and the Docked column

**Files**

- **Create:**
  - `hooks/use-document-viewer.ts`, `hooks/__tests__/use-document-viewer.test.ts`
  - `components/common/document-viewer/placement.ts`
  - `components/common/document-viewer/docked-viewer.tsx`: the presentational `DockedViewerPanel`
    plus the store-connected `DockedDocumentViewer` host, which also renders the fallback drawer.
  - `components/common/document-viewer/close-viewer-on-route-change.tsx`
  - `components/common/document-viewer/__tests__/placement.test.ts`
  - `components/common/document-viewer/__tests__/docked-viewer.test.tsx`
  - `components/common/document-viewer/docked-viewer.stories.tsx`
- **Modify:**
  - `components/layout/dashboard-layout.tsx`
  - `hooks/use-sidebar.ts`: export `SIDEBAR_WIDTH_PX = { minimized: 72, expanded: 240 }`, with a
    comment pointing at the literal classes in `sidebar.tsx`.
  - `documents-table/cells/preview.tsx` and `cells/files.tsx`: remove the drawer and local state.
  - `documents-table/document-actions-menu.tsx`
  - `documents-table/data-table.tsx`: extract `DocumentsTableRow`.
  - `common/documents/issue-document/recent-business-docs.tsx`: render its rows with
    `DocumentsTableRow`.
  - `document-viewer.tsx`: add the `onToggleExpand` and `expanded` props.
  - `edit-document.tsx` stays on the PR 1 drawer (decision 9).

**Store**

```ts
export type DocumentViewerPlacement = 'docked' | 'fallback' // PR 4 renames fallback → 'overlay'
export interface OpenDocumentViewerOptions {
  trigger?: HTMLElement | null
} // PR 5 adds siblings
interface DocumentViewerState {
  current: DocumentViewerEntry | null
  placement: DocumentViewerPlacement | null
  expanded: boolean
  open(entry: DocumentViewerEntry, o?: OpenDocumentViewerOptions): void // re-resolves placement, swaps in place
  toggle(entry: DocumentViewerEntry, o?: OpenDocumentViewerOptions): void // closes if entry.id === current.id
  update(entry: DocumentViewerEntry): void // same id only: refresh stale URLs and titles
  close(): void
  setExpanded(v: boolean): void
}
export const useDocumentViewer = create<DocumentViewerState>()(/* … */)
export function getViewerTrigger(): HTMLElement | null // module-level WeakRef, not store state
export function resetDocumentViewerStore(): void // tests and stories
```

- Zustand v5 has no default equality check, so a selector that returns a new object loops forever.
  Use boolean or primitive selectors, or `useShallow`.

**Placement** (`placement.ts`)

- Constants: `DOCK_MIN_VIEWPORT_PX = 1024`, `DOCKED_MIN_PX = 420`, `PAGE_MIN_PX = 480`.
- `resolveViewerPlacement({ trigger, viewportWidth, sidebarWidth }): 'docked' | 'fallback'`.
- The result is `fallback` when any of these hold:
  - `trigger?.closest('[role="dialog"],[role="alertdialog"]')` matches.
  - The viewport is under 1024px.
  - `viewportWidth − sidebarWidth < 900`.
- The viewport width comes from `document.documentElement.clientWidth`. The sidebar width comes from
  `useSidebar.getState()`.

**Layout**

- Wrap the page column and the docked column in `<div className="relative flex min-w-0 flex-1">`
  after `<Sidebar />`. The page column's classes stay unchanged.
- The docked column is a `<section id="document-viewer" aria-label={`Document viewer:
  ${title}`} className="relative my-14 flex shrink-0 flex-col border-l bg-white">` with
  `style={{ width: `clamp(420px, ${widthExpr}, 100% - 480px)` }}`.
  - `my-14` puts it exactly between the fixed `h-14` header and footer. The page column keeps its
    `my-20`.
  - `widthExpr` defaults to `50%` (see Open question 1) or becomes `${ratio * 100}%` after a drag.
- **Don't give the page column a hard `min-w-120`.** If the window shrinks after docking, a hard
  minimum overflows the `overflow-hidden` row and the docked column ends up partly off-screen. With
  CSS `clamp`, the minimum beats the maximum, so the docked column never drops below 420px and the
  page column absorbs the shortfall by scrolling.
- Placement is resolved only at open time. A later window resize just re-clamps the width.

**Behaviour**

- **Resize handle:**
  `role="separator" aria-orientation="vertical" tabIndex=0 className="absolute inset-y-0 -left-1 w-2 cursor-col-resize touch-none"`.
  - Dragging computes `ratio = (wrapperRect.right − clientX) / wrapperRect.width`, clamped to the
    pixel bounds. The live value is local state.
  - ←/→ change the ratio by 2%. Double-click or Enter resets to the default. Persistence comes in
    PR 5.
- **Expand.** The panel becomes `absolute inset-y-14 left-0 right-0 z-10` inside the wrapper. The
  `<section>` stays in the flow as a spacer of the same width, so the page column neither reflows
  nor loses its scroll position. Expand resets on close.
- **Esc.** Esc closes the viewer only when the keydown comes from inside the section and
  `!e.defaultPrevented` (Radix layers mark an Esc they've handled). Closing with ✕ or Esc focuses
  the trigger with `{ preventScroll: true }` if `trigger.isConnected`. Opening never moves focus.
- **Fallback.** The host renders
  `<DocumentImageDrawer source={current} opened={placement === 'fallback'} onClose={close} />`.
- **Route change.** Put `<CloseViewerOnRouteChange />` (renders `null`) inside `DashboardLayout`:
  `const { pathname } = useLocation(); const prev = useRef(pathname)`. The effect calls `close()`
  only when `prev.current !== pathname`.
  - Making it a separate child keeps `useLocation` from re-rendering the whole layout on every
    navigation.
  - The ref guard ignores the first mount and StrictMode's double effect.
  - Search-string changes don't close the viewer.
- **Triggers.** The Preview and Files cells call
  `toggle(toDocumentViewerEntry(document), { trigger: e.currentTarget })` and set
  `aria-expanded={isActive}`.
- **Actions menu.** Put a `menuTriggerRef` on the `DropdownMenuTrigger` button. "View Image" calls
  `open(entry, { trigger: menuTriggerRef.current })`.
  - `DropdownMenuContent` always portals to `document.body` (`ui/dropdown-menu.tsx`), so the menu
    item can never match `closest('[role=dialog]')`.
  - The `Button` component forwards `ref`, since React 19 passes it as a prop.
  - The actions column can't be hidden, so it also syncs fresh data:
    `useEffect(() => { if (isActive) update(entry) }, [isActive, entry.imageUrl, entry.fileUrl, entry.title, entry.subtitle])`.
    Edits saved in the sheet then refresh the docked viewer.
- **Row highlight.** `DocumentsTableRow<TData extends { id: string }>({ row, className })` uses the
  selector `s => s.current?.id === row.original.id`. It renders `data-viewing` and
  `bg-blue-50 dark:bg-blue-950/40`, and keeps `data-state` free for selection.

**Tests**

- **Store:** open, swap (one `current`, no stacking), toggle-close, `update` ignores other ids, the
  trigger is absent from `getState()`, reset in `beforeEach`.
- **Placement:** dialog and alertdialog ancestors give fallback; viewport 1023 gives fallback; 1024
  with a minimized sidebar docks; 1100 with an expanded sidebar gives fallback; a null trigger is
  handled.
- **Docked viewer:**
  - Renders nothing when closed, and a labelled region when open.
  - ✕ closes and focuses the trigger.
  - Esc inside closes; Esc outside, or with `defaultPrevented`, does not.
  - Expand toggles. Separator keys change the width style, and double-click resets it.
- **Route change:** `MemoryRouter` with a navigate probe. A new pathname closes the viewer; a new
  search string does not.
- **Cells:** Preview and Files call the store and reflect `aria-expanded`. `DocumentsTableRow`
  highlights using a minimal fake `row` cast.

**Stories.** `docked-viewer.stories.tsx` renders `DockedViewerPanel` from props inside a mock work
area, with Default, Expanded and AtMinimum stories. Don't use the global store here:
`stories.test.tsx` mounts every story of a file one after another in the same module instance, so
store state would leak between stories.

**Manual QA**

- [ ] At 1440×900 with the sidebar minimized, the docked column is about 684px. With the sidebar
      open, measure the page width in devtools (Open question 1).
- [ ] The table scrolls sideways in the page column. On open, the page column is at least 480px.
- [ ] Opening another row swaps the document and moves the highlight. The React Profiler shows only
      two rows re-rendering.
- [ ] Clicking the active thumbnail closes the viewer. Esc works only from inside it. A route change
      closes it; a filter or query-string change doesn't.
- [ ] From the issue-document edit dialog (Recent docs tables), the drawer opens above the dialog
      instead of docking behind it.
- [ ] Between 1024 and 1139px with the sidebar expanded, the drawer fallback is used.
- [ ] Resizing the window while docked never pushes anything off-screen.
- [ ] Charges page with several charges expanded works.
- [ ] Known until PR 3: the edit sheet still uses the drawer, and the docked column sits under the
      sheet.

**Done when.** No documents-table cell mounts a drawer, there is a single viewer instance, tests are
green with `tsc`, and the QA list is ticked.

---

### PR 3: Embedded split in the edit sheet

**Files**

- **Modify:**
  - `common/modals/drawer.tsx`: add `size: 'tall'` →
    `data-[vaul-drawer-direction=bottom]:h-[90vh] data-[vaul-drawer-direction=bottom]:max-h-[90vh]`,
    plus the flex body.
    - The sheet needs a _definite_ height. With only a max-height, a short form collapses the viewer
      pane.
    - There is no core 90vh utility, so this mirrors the existing `max-h-[80vh]`.
  - `common/modals/edit-document-modal.tsx`:
    - `size="tall"`.
    - `<EditDocument key={documentId} … />`: remount per document, needed by PR 5.
    - `useSuspendDockedViewer(!!documentId)` placed **before** the existing
      `if (!documentId) return null`, so the hook still runs on the closed path.
  - `common/forms/edit-document.tsx`: remove the thumbnail column and `DocumentImageDrawer`. Render
    `<DocumentEditSplit form={…} viewer={<DocumentViewer … />} />` and use
    `SimpleGrid cols={hidden ? 4 : 2}`.
    - `SimpleGrid`'s breakpoints are based on the viewport, so the pane width can't drive them.
    - The "Open File" grid cell stays.
  - `hooks/use-document-viewer.ts`: add `suspendCount` and `suspend(): () => void`. The returned
    resume function is idempotent.
  - `docked-viewer.tsx`: render `null` while suspended, keeping `current`.
  - `document-viewer.tsx`: add `closeVariant?: 'close' | 'hide'`.
- **Create:**
  - `components/common/document-viewer/edit-split-layout.tsx`:
    `DocumentEditSplit({ form, viewer, hidden, onHiddenChange })`.
  - `components/common/document-viewer/edit-split-layout.stories.tsx`
  - `components/common/document-viewer/__tests__/edit-split-layout.test.tsx`
  - `common/forms/__tests__/edit-document.test.tsx`

**Behaviour**

- **At `lg` and above:** form pane (`overflow-y-auto`, `data-vaul-no-drag`), then a separator, then
  the viewer pane (`data-vaul-no-drag`). Each pane is at least 320px (`min-w-80`). The split
  defaults to 50/50, and double-click resets it.
- **Opening.** The viewer shows at Fit width immediately, with source
  `toDocumentViewerEntry(document)` and key `document.id`.
- **Hide document ⇥** collapses the viewer to a `w-10` strip with a "Show document" button, and the
  grid goes to 4 columns. The hidden state is in memory until PR 5 persists it.
- **Expand ⤢ on desktop** widens the viewer over the form pane, using the same absolute-overlay
  pattern as the docked column, and toggles back.
- **Below 1024px:** the layout stacks, with the viewer in an `h-[45vh]` collapsible section above
  the form. Expand is hidden until PR 4.
- **Empty document.** A document with neither image nor file shows "No image or file attached"
  instead of auto-collapsing, so there is room for PR 5's live preview.
- **Focus.** The viewer is inside the sheet's focus scope. `PortalContainerContext` still serves the
  form's popovers.
- **Esc** closes the sheet (vaul). The embedded viewer does nothing on Esc.

**Tests**

- **Split layout:** both panes carry `data-vaul-no-drag`; Hide collapses and Show restores;
  separator keys work; the ratio is clamped.
- **`EditDocument`** (`vi.mock('urql')` `useQuery`): the viewer title is "Tax Invoice 1042"; there
  is no thumbnail button; the grid has 2 columns, and 4 after Hide.
- **Store:** suspend and resume counts; a StrictMode double mount ends at 1, then 0 after unmount;
  the docked viewer is hidden while suspended.

**Manual QA**

- [ ] At 1440×900, the page is at least 600px wide at Fit width (acceptance criterion 1).
- [ ] Every field is visible and can be typed into while the viewer shows (acceptance criterion 2).
      Combobox and date popovers work.
- [ ] The panes scroll independently, and Save stays reachable.
- [ ] A drag on the viewer pans; a drag in a form field selects text; neither moves the sheet.
      Dragging the header still dismisses the sheet.
- [ ] Hide/Show and split drag and reset work.
- [ ] Docked viewer open, then Edit on the same table: the docked viewer hides. Closing the sheet
      brings it back.
- [ ] The other five bottom sheets keep their height.
- [ ] Below 1024px the layout stacks.
- [ ] The charge gallery opens the edit sheet with the split.

**Done when.** The edit flow no longer uses the drawer, and tests are green with `tsc`.

---

### PR 4: Overlay (mobile and above modals); delete the drawer

**Files**

- **Create:**
  - `components/common/document-viewer/overlay-viewer.tsx`: `OverlayDocumentViewer` host plus a
    presentational `OverlayViewerFrame`.
  - `components/common/document-viewer/use-overlay-history.ts`
  - `components/common/document-viewer/__tests__/overlay-viewer.test.tsx`
  - `components/common/document-viewer/__tests__/use-overlay-history.test.tsx`
  - `components/common/document-viewer/overlay-viewer.stories.tsx`
- **Modify:**
  - `placement.ts` and the store: placement becomes `'docked' | 'overlay'`, plus
    `overlayMode: 'fullscreen' | 'sheet'` (fullscreen under 1024px).
  - `docked-viewer.tsx`: drop the fallback drawer.
  - `dashboard-layout.tsx`: mount the overlay host.
  - `edit-split-layout.tsx`: the stacked Expand calls `open(entry, { trigger })`.
  - `viewer-toolbar.tsx`: put `@container` on the viewer root and use `@md:`/`@lg:` variants, so
    narrow docked and embedded panes condense too. Add a `⋯` DropdownMenu that holds the Magnifier
    when narrow; Rotate joins it in PR 5.
  - `drawer.tsx`: remove `'document'`, `withHeader` and `accessibleTitle` if nothing uses them
    anymore.
- **Delete:** `components/common/document-image-drawer.tsx` and its export in `common/index.ts`.

**Overlay**

- Build it from the `radix-ui` `Dialog` primitives. Don't use `ui/sheet.tsx`, which always renders a
  `bg-black/50` overlay and an extra close button.
- Root: `Root open={placement === 'overlay'} onOpenChange={o => !o && requestClose()}`.
- Content: `Content aria-describedby={undefined}`.
  - `onOpenAutoFocus` focuses the canvas.
  - `onCloseAutoFocus={e => { e.preventDefault(); const t = getViewerTrigger(); if (t?.isConnected) t.focus(); }}`.
    Radix only restores focus to a `DialogTrigger`, and there isn't one here.
- Add a `Title` with `className="sr-only"`.
- **No `Dialog.Overlay`.** That also means no Radix scroll lock, so the canvas relies on
  `overscroll-contain`.
- **Classes:**
  - fullscreen: `fixed inset-0 z-1001 bg-white`
  - sheet: `fixed inset-y-0 right-0 z-1001 w-1/2 min-w-105 border-l bg-white shadow-xl`
- **Use `z-1001`, not `z-1002`.** It sits above the modal because its portal mounts later in the
  DOM. `ui/tooltip.tsx` and `ui/dropdown-menu.tsx` portal to the body at `z-1001` and don't read a
  portal container from context, so a `z-1002` overlay would hide the viewer's own tooltips and its
  `⋯` menu.
- **A global host works.** `yarn.lock` resolves a single `@radix-ui/react-dialog@1.2.0` (vaul's
  `^1.1.1` included), plus one `react-dismissable-layer` and one `react-focus-scope`. Radix's layer
  and focus stacks are module-global, so the overlay joins the modal's stack without being rendered
  inside the modal's React tree.
- **It must stay modal.** If it weren't, the parent dialog would treat clicks inside the overlay as
  outside clicks and close itself. Esc closes only the overlay.

**History** (fullscreen only; decision 13)

- **Push.** An effect pushes when the overlay is fullscreen with a `current` document,
  `!isDocViewerState(location.state)` and `!pushedRef.current`. It sets the ref, then calls
  `navigate(location, { state: { ...state, docViewer: true } })`. The ref guard stops StrictMode's
  second effect run from pushing twice, because that run happens before the location updates.
- **Back.** If `pushedRef.current` is set and `docViewer` is now falsy, clear the ref and call
  `close()`.
- **`requestClose` (✕ and Esc).** In fullscreen with `docViewer` set, call `navigate(-1)` _only_ and
  let the Back path close the viewer. Calling `close()` first would trip the leftover rule, which
  would replace the entry before the back navigation lands. Otherwise, call `close()`.
- **Leftover flag.** On every location change, not only on load: if `docViewer` is set and there is
  no `current`, call
  `navigate(location, { replace: true, state: { ...state, docViewer: undefined } })`. This also
  covers going Back into an entry left behind after a pathname change cleared the store.
- **Swapping** documents while open needs no navigation.
- Narrow the state with `isDocViewerState(s: unknown): s is { docViewer: true }`.
- **Inertia.** Add light touch inertia here: track the last 100ms of velocity and decay it with rAF.
  It is cancelled on the next `pointerdown` and off under reduced motion. Canvas `touch-none`
  otherwise drops native momentum.

**Tests**

- **Placement:** a dialog trigger at 1440px gives `overlay`/`sheet`; any trigger at 800px gives
  `fullscreen`; a menu-trigger ref inside a dialog is detected.
- **Overlay:**
  - It renders `role=dialog` with a title and no backdrop element.
  - Esc closes it, and focus returns to a stub trigger.
  - Sheet and fullscreen use the right classes.
  - With a `ui/dialog` Dialog opened first, Esc closes only the overlay.
- **History** (`<StrictMode>` with `MemoryRouter` and a location probe):
  - Opening pushes exactly one entry.
  - `navigate(-1)` closes the viewer.
  - ✕ goes back.
  - A leftover flag on mount is replaced.

**Stories.** Use `OverlayViewerFrame` from props: FullScreen, and SheetOverModal (an open
`ui/dialog` plus the sheet). Portaled output is counted by `stories.test.tsx`.

**Manual QA**

- [ ] iOS Safari and Android Chrome at 390px: full screen; pinch, double-tap and pan work; no
      swipe-dismiss. Back closes only the overlay. ✕ leaves no forward entry. Reloading with the
      overlay open leaves no stale state.
- [ ] Tablet at 768px: fullscreen overlay.
- [ ] Desktop issue-document dialog: the sheet opens on the right with the modal visible on the
      left. Esc closes only the overlay, focus returns into the modal, and tooltips are visible.
- [ ] Edit sheet below 1024px: Expand opens the fullscreen overlay above the sheet, and Back closes
      only the overlay.
- [ ] Between 1024 and 1139px with the sidebar expanded, the overlay sheet opens (not the drawer).
- [ ] `grep DocumentImageDrawer` returns nothing.
- [ ] On pages that use `useUrlQuery.set`, check Back. It writes `history.pushState` directly, which
      bypasses the router's state.

---

### PR 5: Should items

Scope: stepper with the active row following, Save & next, rotate, shortcuts (decision 17),
persisted sizes, and the live image-URL preview.

**Files**

- **Create** in `components/common/document-viewer/`: `viewer-stepper.tsx`,
  `use-viewer-shortcuts.ts`, `persisted-sizes.ts` (keys and revive guards) and `siblings.ts`, with
  tests for each.
- **Modify:**
  - The store: add `siblings: DocumentViewerEntry[] | null`, `step(delta: 1 | -1)`,
    `reconcileRowIds(prev: string[], next: string[])`,
    `keyboardOwners: { id: string; rank: 0 | 1 | 2 }[]` and
    `registerKeyboardOwner(id, rank): () => void`.
  - `documents-table/columns.tsx`: cells receive `table` (`cell: ({ row, table }) => …`).
    `editDocument: (siblingIds?: string[]) => void`.
  - `cells/preview.tsx`, `cells/files.tsx`, `document-actions-menu.tsx`: add
    `table?: AnyTable<DocumentsTableRowType>`. Precedent: `documents-batch-actions-menu.tsx`.
  - `use-documents-table.ts`: core state becomes `{ id, siblingIds }`. It returns `editSiblingIds`
    and `navigateEditDocument(id)`.
  - The four openers pass `siblingIds` and `onNavigate`: `documents-table/index.tsx`,
    `screens/documents/all-documents/index.tsx`, `documents-gallery.tsx`
    (`additionalDocuments.map(d => d.id)`) and `recent-business-docs.tsx` (its own table's rows).
  - `edit-document-modal.tsx`: `siblingIds?: string[]; onNavigate?: (id: string) => void`.
  - `edit-document.tsx`
  - `data-table.tsx`: call reconcile when row ids change.
  - Toolbar (Rotate), the docked viewer and the split layout (persistence).

**Behaviour**

- **Siblings.**
  - `buildViewerSiblings(table)` maps `table.getRowModel().rows` through `toDocumentViewerEntry` and
    **filters** with `hasViewerAttachment`. Stepping can then never land on an empty viewer.
  - `getRowIds(table)` is **unfiltered** for Save & next, because editing a document with no image
    is legitimate. Both come from the same table snapshot, per decision 14.
- **Stepper `‹ 3/12 ›`.**
  - It shows only when there are at least 2 siblings and they include `current`. There is no
    wrap-around.
  - `step` never re-resolves placement or touches history.
  - Reconcile: if the current id was in the previous row ids but not the new ones, set
    `siblings = null`, which hides the stepper.
- **Embedded viewer has no siblings.** It shows no stepper and `[`/`]` do nothing there, since
  stepping the sheet would discard unsaved edits. Save & next is the in-sheet navigation (decision
  11).
- **Save & next.**
  `handleSubmit(async data => { const r = await updateDocument(…); if (!r) return; onChange(); onNavigate(nextId) })`.
  - `execute` in `use-api-mutation.ts` resolves `undefined` on failure, and the hook already shows
    the toast.
  - The button is disabled when there is no next id, nothing is dirty, or a save is in flight. It is
    also disabled if the current id is missing from `siblingIds`.
  - PR 3's `key={documentId}` remounts the form with fresh defaults.
- **Rotate ⟲.** Each click turns 90°. Rotation resets when `documentKey` changes. A fit mode
  re-applies; a custom zoom is kept with the scroll re-clamped. In the overlay, Rotate goes in the
  `⋯` menu.
- **Shortcuts.**
  - **Owner stack.** Each viewer registers with `rank` docked 0, embedded 1, overlay 2, and a stable
    `useId()`. That keeps it StrictMode-safe.
  - **Single listener.** Only the owner with the highest rank (latest one on a tie) attaches the
    `document` keydown listener.
  - **Skipped events:** targets in input, textarea, select, `[contenteditable]`, `[role=menu]`,
    `[role=listbox]` or `[data-radix-popper-content-wrapper]`; Ctrl, ⌘ or Alt held; `isComposing`.
  - **Letters, digits and brackets match on `event.code`:** `KeyR`, `KeyM`, `Digit0`/`Numpad0`,
    `Digit1`/`Numpad1`, `BracketLeft`/`BracketRight`. The Hebrew layout turns R into ר and M into צ,
    and it mirrors the brackets, so `event.key` breaks for Israeli users.
  - **`+`, `=` and `-` match on `event.key`,** with `Equal`, `Minus`, `NumpadAdd` and
    `NumpadSubtract` as fallbacks.
  - Handled keys call `preventDefault`. Esc stays focus-scoped. Tooltips show each key.
- **Persisted sizes.** Use the architect's keys.
  - Revive accepts `null` (meaning the default) or a number in (0, 1), clamped to 0.2–0.8. The
    hidden flag is a boolean.
  - Write only on drag end, key press or reset. During a drag, keep a live local ratio and commit it
    on `pointerup`.
- **Live image-URL preview.** Watch `watch('image')`, debounced 400ms. Use the value only if
  `URL.canParse` (with a try/catch fallback) succeeds and the protocol is http or https; otherwise
  use the stored URL. Put the URL in the `documentKey` so a new URL resets the canvas.
- **Preload.** Stepping preloads the next and previous siblings' images with `new Image().src`.

**Tests**

- **Store:** step bounds; the sibling snapshot doesn't change with later rows; reconcile drops
  siblings; owner ordering.
- **Shortcuts:**
  - Every key fires its handler.
  - Shortcuts are skipped in inputs, contenteditable and menus, and with modifier keys.
  - `{ key: 'ר', code: 'KeyR' }` rotates, and `code: 'BracketLeft'` steps back.
  - Only the topmost owner reacts.
- **Stepper:** shows "3/12"; disabled at the ends; hidden when siblings are null or fewer than 2.
- **Save & next:** with `useUpdateDocument` mocked, success navigates and calls `onChange`;
  `undefined` stays put; the button is disabled on the last document or when nothing is dirty.
- **Persisted sizes:** revive rejects NaN, values above 1 and strings.
- **Live preview** (fake timers): a valid URL swaps the `src` after the debounce; an invalid one
  keeps the stored URL.

**Manual QA**

- [ ] Documents report, page 1 sorted by date: steps follow the sort and the highlight follows.
- [ ] Deleting the current document hides the stepper.
- [ ] Inside a charge, stepping stays within that charge's documents.
- [ ] With the Hebrew layout, shortcuts work and don't fire in inputs. ⌘0 and ⌘= still zoom the
      browser.
- [ ] Save & next across three documents; a failed save stays put; the button is disabled on the
      last document.
- [ ] Sizes survive a reload. Corrupt `localStorage` and a private window fall back safely.
- [ ] A sideways scan rotates; the loupe follows the rotation.
- [ ] Live URL preview works.

---

### Cross-cutting notes

- **Cells and `table`.** Cells render through
  `flexRender(cell.column.columnDef.cell, cell.getContext())` (`data-table.tsx`), so
  `({ row, table })` is available in every cell definition in `columns.tsx`. Pass `table` to cells
  as `AnyTable<DocumentsTableRowType>`. `getRowModel()` returns every row on unpaginated tables and
  the current page (100 rows) on the documents report.
- **`PopUpDrawer` options.** It doesn't forward `className` today; `DrawerContent` does, through
  `cn` (tailwind-merge). Overrides must use the same `data-[vaul-drawer-direction=…]:` prefix. All
  six bottom sheets pass a `modalSize` that is ignored; leave those props alone.
- **`DashboardLayout`.** The header and footer are `fixed` at `h-14` and `z-20`. The flex row is
  `h-screen overflow-hidden`, and the page column uses `my-20`. The sidebar widths exist only as
  `w-[72px]`/`w-[240px]` classes, so export constants for the placement check.
- **Router.** `react-router-dom` 7.18.4; `DashboardLayout` renders inside `RouterProvider`.
  `StrictMode` is on (`src/index.tsx`), so every effect must be symmetric or guarded by a ref.
- **Gallery.** `documents-gallery.tsx` keeps `openModal` (an id) and renders one
  `EditDocumentModal`. Its list is `additionalDocuments` (`id`, `image`, `documentType`), in
  carousel order.
- **Stories.** `stories.test.tsx` mounts every story of a file one after another into the same root.
  A story passes if the container or new `body` children are non-empty, so portaled stories are
  fine. A real urql client points at `localhost:4000`, so stories must not query. happy-dom never
  loads images. Module-level stores leak between stories, so stories render presentational
  components from props.
- **Code style.** Named exports, `ReactElement` return types, `.js` import suffixes, core Tailwind
  classes (the vh classes are documented exceptions). Import `../tooltip.js` directly, not the
  `common/index.js` barrel.
- **Tests.** `IS_REACT_ACT_ENVIRONMENT = true`; co-located `__tests__/`;
  `resetDocumentViewerStore()` in `beforeEach`. Stub `ResizeObserver` with `vi.stubGlobal`, and
  `matchMedia` where needed. `PointerEvent` works under happy-dom (see
  `accountant-status-menu.test.tsx`). Run `yarn generate`, `yarn test:client`,
  `yarn workspace @accounter/client exec tsc --noEmit` and `yarn lint`, and confirm the test count
  went up after each restack.
- **Reduced motion.** Zoom is instant, nothing slides in (use `motion-safe:` only), and there is no
  smooth scroll. The spinner already handles reduced motion.
- **Dark mode.** `.dark` is never applied today (`index.css` says the variant is inert). Add `dark:`
  variants for parity, but they don't need QA. The page stays white.
- **Cleanup.** Every listener is removed on unmount and on drag end, and the `ResizeObserver`
  disconnects. Don't use `<canvas>`: reading Cloudinary pixels would taint it, and nothing here
  needs one.

### Risks this breakdown resolves

| Risk                                                                                      | PR   | Resolution                                                                                            |
| ----------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| Fit page can't show a very tall receipt at a 25% minimum zoom                             | 1    | Minimum zoom = `min(0.25, fitPage)`                                                                   |
| `justify-center` in a scroll box clips the left edge                                      | 1    | `w-max min-w-full` wrapper with an `mx-auto` page box                                                 |
| Fit width oscillates when the scrollbar appears                                           | 1    | `[scrollbar-gutter:stable]`; measure `clientWidth`                                                    |
| CSS rotation doesn't change scroll extents                                                | 1, 5 | The page box is the rotated bounding box; the image is centred and transformed inside it              |
| React `onWheel` is passive                                                                | 1    | `addEventListener('wheel', h, { passive: false })`                                                    |
| `GestureEvent` isn't typed in `lib.dom`; iOS fires both gesture and pointer events        | 1    | Local type; skip gesture events while touch pointers are down                                         |
| vaul's `pointerdown` steals pointer capture; `stopPropagation` breaks Radix outside-click | 1    | `window` drag listeners, no `lostpointercapture`, never `stopPropagation`; `handleOnly` on the drawer |
| Native image drag ghost                                                                   | 1    | `draggable={false}` and `onDragStart` `preventDefault`                                                |
| The zoom anchor drifts when `setState` lags the DOM                                       | 1    | Apply size and scroll through refs, then mirror into state                                            |
| `naturalWidth` = 0, cached loads, no load event in happy-dom                              | 1    | "Unsized" fallback, a `complete` check, tests dispatch `load`                                         |
| Drawer size override silently loses to the house classes                                  | 1    | Same variant prefixes; the body wrapper becomes `flex-1 min-h-0`                                      |
| Hebrew names reorder `→` in the subtitle                                                  | 1    | FSI/PDI isolates                                                                                      |
| `javascript:` URLs in Open original                                                       | 1    | `isSafeHttpUrl` guard                                                                                 |
| The menu-item trigger is portaled, so dialog detection fails                              | 2, 4 | Use the `DropdownMenuTrigger` ref as the trigger                                                      |
| Docking from tables inside the issue-document dialog lands behind its backdrop            | 2    | Dialog check ships in PR 2                                                                            |
| A hard `min-w-120` on the page column overflows the row                                   | 2    | `clamp` on the docked column only                                                                     |
| The store holds a DOM element                                                             | 2    | Module-level `WeakRef`; `isConnected` before focusing                                                 |
| Zustand v5 selectors that return new objects loop forever                                 | 2    | Boolean selectors or `useShallow`                                                                     |
| The docked entry goes stale after a save in the sheet                                     | 2    | `update()` synced from the actions-menu cell                                                          |
| Esc arrives already handled by a Radix layer                                              | 2    | Check `defaultPrevented`                                                                              |
| `useLocation` re-renders the whole layout on navigation                                   | 2    | Separate null-rendering child                                                                         |
| The suspend hook would sit after `EditDocumentModal`'s early return                       | 3    | Call it before the return, with an `active` argument                                                  |
| `SimpleGrid` breakpoints follow the viewport, not the pane                                | 3    | `cols={hidden ? 4 : 2}`                                                                               |
| A `z-1002` overlay hides body-portaled tooltips and menus                                 | 4    | `z-1001` and portal order                                                                             |
| StrictMode pushes the history entry twice; `close()` and `navigate(-1)` race              | 4    | Ref guard; a single close path through Back                                                           |
| The overlay has no scroll lock without `Dialog.Overlay`                                   | 4    | `overscroll-contain`                                                                                  |
| `touch-none` drops native momentum on touch                                               | 4    | Light inertia, off under reduced motion                                                               |
| Stepping could land on documents with nothing attached                                    | 5    | Viewer siblings are filtered; Save & next ids are not                                                 |
| `[`/`]` in the edit sheet would drop unsaved edits                                        | 5    | The embedded viewer has no siblings                                                                   |
| Hebrew layout breaks `event.key` shortcut matching                                        | 5    | Use `event.code` for letters, digits and brackets                                                     |
| `usePersistentState` writes on every pointer move                                         | 5    | Commit on drag end                                                                                    |
| The form keeps the old document's state after Save & next                                 | 3, 5 | `key={documentId}`                                                                                    |

---

# Design definition (UX baseline)

> The UX target the decisions above refine. Where they conflict, the decisions log wins (notably:
> Download is dropped, and shortcuts are global while open rather than focus-scoped).

## Context

People open a document's scan for one reason: to **check or correct its details against the paper**.
That means comparing the date, amount, VAT, serial number and counterparty. Today
`DocumentImageDrawer` makes this hard:

1. **Too narrow to read.** It uses the shared vaul drawer width (`w-3/4 sm:max-w-sm`, about 384px).
   An A4 scan at that width renders 10pt text at about 6.5px.
2. **It covers the work.** It overlays the right side of the screen. In the edit flow it stacks a
   second drawer on top of the full-width bottom edit sheet (`EditDocumentModal`, both at `z-1001`),
   hiding the right-hand form fields.
3. **It blocks the form.** vaul 1.1.2 keeps the Radix dialog modal, so focus is trapped (see
   `providers/portal-container.ts`). You cannot type into the form while the scan is open.
4. **Reading depends on hover.** The magnifier is the only way to read. It does nothing on touch and
   hides the area under the cursor.
5. **Confusing controls.** Zoom and loupe size use the same `ZoomIn`/`ZoomOut` icons, floating over
   the image at `top-10 right-10`.
6. **Gestures conflict.** vaul's swipe-to-dismiss captures drags, so panning a zoomed scan would
   dismiss the drawer.
7. **Gaps.** It has no fit modes, no rotation, no loading or error state, and its alt text is "img".
   It never receives the original `file` URL. Every table row mounts its own drawer, so previews
   stack instead of swapping.

How readable an A4 page is at a given rendered width:

| Rendered page width | 10pt body text appears at |
| ------------------- | ------------------------- |
| 384px (today)       | ~6.5px (unreadable)       |
| 520px               | ~8.7px (strained)         |
| 600px               | ~10px (readable)          |
| 840px               | ~14px (comfortable)       |

**Target:** at least 600px of page width on a 1440px-wide laptop by default.

## Design goals

- Read a typical invoice or receipt **without the magnifier** on a desktop screen.
- See the document **and** the fields being checked **at the same time**, never one over the other.
- Handle any shape, including A4 or Letter portrait, landscape, long thermal receipts and small
  photos. **Nothing is ever cut off.**
- Mobile is no worse than today.
- Present one consistent viewer everywhere, with the document always on the **right**.

## Concept: one viewer, three presentations

The component is renamed **Document Viewer**. It is a reading surface that sits **beside** the work,
not on top of it. The viewer's contents (toolbar, canvas, states) are identical everywhere. Only its
container changes:

| Presentation | When                                                                                     | Container                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Docked**   | Opened from a page (documents table, charge row, actions menu) on a screen ≥ 1024px wide | A resizable column on the right of the dashboard. The page column **shrinks**. Nothing is covered. |
| **Embedded** | Inside the edit-document surface                                                         | Always visible as the right pane of a split layout. No click is needed to see the scan.            |
| **Overlay**  | Screens < 1024px, **or** when the trigger is inside a modal dialog                       | A full-screen view on mobile. Over a modal, a full-height right sheet with no backdrop.            |

### 1. Docked (desktop pages)

```
┌───────────────────────────────── Header ──────────────────────────────────────┐
├───────┬──────────────────────────────────┬┬───────────────────────────────────┤
│       │ Charges › Documents              ││ Invoice 1042 · Acme Ltd   ‹ 3/12 › │
│ Side- │ ┌──────┬───────┬───────┬───────┐ ││                           ⤢  ↗  ✕ │
│ bar   │ │      │ date  │ amount│ vat   │ │├───────────────────────────────────┤
│       │ │ ▣    │ 02/10 │ 2,360 │ 360   │ ││ ⟲   − 112% +   [Page│Width│1:1] ⌕ │
│       │ │▶▣    │ 03/10 │ 1,180 │ 180   │◀┼┤┌─────────────────────────────────┐│
│       │ │ ▣    │ 05/10 │   590 │  90   │ │││  ACME LTD            INVOICE    ││
│       │ └──────┴───────┴───────┴───────┘ │││  No. 1042        03/10/2026     ││
│       │                                  │││  ...........................    ││
│       │                                  │││  Total            ₪1,180.00     ││
│       │                                  ││└─────────────────────────────────┘│
├───────┴──────────────────────────────────┴┴───────────────────────────────────┤
│                                   Footer                                      │
└───────────────────────────────────────────────────────────────────────────────┘
                                            ↑ drag to resize · double-click to reset
```

- **Where it lives:** a third column in the dashboard layout
  (`components/layout/dashboard-layout.tsx`), after the scrolling page column and between the header
  and footer. It is full height and scrolls internally.
- **Width:** by default it takes **half the space to the right of the sidebar**. On a 1440px screen
  with the sidebar open, that is about 600px. The minimum is **420px**, and the page column always
  keeps at least **480px**. If both minimums can't fit, it falls back to Overlay.
- **Resizable** by dragging its left edge. Double-click the edge to reset. The width is remembered
  per browser and falls back to the default if storage is unavailable.
- **Non-modal.** It has no backdrop and no focus trap, and the page stays fully interactive.
- **Single instance.** Opening another document **swaps** the content in place. The table row being
  viewed gets an "active" highlight (`▶` in the wireframe).
- **‹ 3/12 › stepper** (Should): steps through the documents of the table the viewer was opened
  from, in table order. The active row follows, and `[` / `]` are the shortcuts.
- **Expand ⤢:** temporarily widens the viewer over the whole page column for a close read. Click it
  again to restore the width.
- **Closes** with ✕, with `Esc` while focus is inside it, and on route change.

### 2. Embedded (edit document: the core review flow)

Today the edit sheet is a 4/5 form beside a 1/5 thumbnail that opens a covering drawer. Instead, the
edit surface **is** the split view:

```
┌ Edit Document · ID 8f2c… ⧉   Unlink   Delete ──────────────────────────────── ✕ ┐
│ ┌─ Details ───────────────────────────┐┊┌─ Invoice 1042 · Acme Ltd ─── ⤢ ↗ ⇥ ┐ │
│ │ Type        [Invoice      ▾]        │┊│ ⟲   − Fit width +   [Page│Width│1:1] │ │
│ │ Serial      [1042         ]         │┊│ ┌──────────────────────────────────┐ │ │
│ │ Date        [03/10/2026   ]         │┊│ │  ACME LTD             INVOICE    │ │ │
│ │ Amount      [1,180.00] [ILS ▾]      │┊│ │  No. 1042         03/10/2026     │ │ │
│ │ VAT         [  180.00] [ILS ▾]      │┊│ │  ...........................     │ │ │
│ │ Creditor    [Acme Ltd     ▾]        │┊│ │  VAT 18%               ₪180.00   │ │ │
│ │ Debtor      [My Company   ▾]        │┊│ │  Total               ₪1,180.00   │ │ │
│ │ Description [...]                   │┊│ └──────────────────────────────────┘ │ │
│ │                          [ Save ]   │┊└──────────────────────────────────────┘ │
│ └─────────────────────────────────────┘┊                                         │
└────────────────────────────────────────┴─────────────────────────────────────────┘
                                         ↑ split handle (drag / double-click reset)
```

- **Layout:** form on the left, document on the right, split **50 / 50** by default and adjustable.
  The split ratio is remembered separately from the docked width. The form's grid reflows from 4
  columns to 2 in this narrower pane.
- **Visible on open.** The scan shows immediately at Fit width, with no extra click. The thumbnail
  column and the separate drawer are removed.
- **Hide document ⇥** collapses the pane to a slim strip and gives the form full width. That choice
  is remembered too.
- **Live URL preview** (Should): editing the "Image URL" field in `ModifyDocumentFields` updates the
  viewer once the value is a valid URL.
- **Taller sheet.** The edit sheet grows from `max-h-[80vh]` to about 90vh, and each pane scrolls on
  its own so the Save button stays reachable.
- **No drag conflict.** Drags on the viewer canvas pan the image and never dismiss the surrounding
  bottom sheet.
- **If the docked viewer is already open** on the page, it hides while the edit sheet is open, so
  the same scan never shows twice.
- **Below 1024px:** the document sits **above** the form as a fixed-height (about 45% of the
  viewport) collapsible section. Its ⤢ opens the full-screen Overlay.

### 3. Overlay (mobile, and above modals)

- **Mobile (< 1024px):** a full-screen view with the toolbar pinned at the top and ✕ in the top
  right.
  - **No swipe-to-dismiss.** Drags pan the image.
  - Pinch to zoom, and double-tap to toggle between fit and 2×.
  - Rotate and the magnifier move into a `⋯` menu.
- **Over a modal:** some modals render a documents table, such as `RecentDocsOfSameType` inside
  `edit-issue-document-modal.tsx` (a Radix `Dialog`). From there the viewer opens as a full-height
  right sheet stacked above the modal. It has the docked width rules and no backdrop of its own, so
  the modal stays visible on the left. Closing it returns focus to the modal.

## Inside the viewer (same in all three presentations)

### Header

- **Title:** document type, serial number and counterparty when known, such as
  `Invoice 1042 · Acme Ltd`. Otherwise it shows "Document". Long titles truncate with a tooltip.
- **Actions:** Expand ⤢, Open original ↗ (the `file` URL, else `image`, in a new tab), and Close ✕
  or Hide ⇥.
- **Open original** also serves dual-monitor users and multi-page PDFs.

### Toolbar (sticky, never overlays the image)

```
[⟲]   [−] 112% [+]   [ Fit page │ Fit width │ 100% ]   [⌕ Magnifier]
```

- **Fit modes** (segmented control):
  - **Fit width** is the **default**. The page width equals the pane width, and you scroll down.
    This is best for A4 and Letter.
  - **Fit page** shows the whole page with no scrolling. Use it for a quick glance or landscape
    pages.
  - **100%** is the natural pixel size.
- **Zoom:** − and + step by ×1.25, within 25% to 800%. Click the % readout to type a value.
  - Any explicit zoom switches the mode to "Custom".
  - A fit mode re-applies when the pane is resized. A custom zoom stays as it is.
- **Rotate ⟲:** turns the image 90° clockwise, for sideways scans. It resets when the document
  changes.
- **Magnifier ⌕:** the existing hover loupe, kept as an **opt-in toggle** and **off by default**.
  - When it is on, one "Loupe size: S / M / L" control replaces today's duplicate icon pairs.
  - It is hidden on touch devices.

### Canvas

- The page sits on white with a thin border and a soft shadow, over a neutral grey backdrop
  (`bg-gray-100`), so white scans still show their edges.
- It is centred horizontally when narrower than the pane and aligned to the top.
- **It scrolls on both axes** whenever the page is larger than the pane. Nothing is clipped.
- **Drag to pan** when zoomed in, with a grab cursor.
- **Ctrl/⌘ + wheel** and trackpad pinch zoom **around the cursor**. A plain wheel scrolls.
- **Double-click or double-tap** toggles between the current fit and 200% at that point.

### Shape rules (applied automatically on load)

| Document shape                      | Behaviour                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A4 / Letter portrait                | Fit width, scroll down.                                                                                                                       |
| Landscape (width > height)          | Fit width, which usually equals fit page.                                                                                                     |
| Long receipt (height / width > 2.5) | Fit width, **but never upscaled beyond the image's natural width**. A narrow receipt stays crisp and centred instead of stretched and blurry. |
| Small image (natural width < pane)  | Same no-upscale cap. The user can still zoom in explicitly.                                                                                   |

### Keyboard (when they fire: see decision 17)

| Key       | Action                                                                             |
| --------- | ---------------------------------------------------------------------------------- |
| `+` / `-` | Zoom in / out                                                                      |
| `0`       | Default fit (Fit width)                                                            |
| `1`       | 100%                                                                               |
| `R`       | Rotate 90°                                                                         |
| `M`       | Toggle magnifier                                                                   |
| `[` / `]` | Previous / next document (Docked, Should)                                          |
| `Esc`     | Close (Docked, Overlay). In the edit sheet, `Esc` closes only the topmost surface. |

Every control has an `aria-label` and a tooltip that shows its shortcut.

### States

- **Loading:** `<AccounterSpinner />` centred in the canvas. The header and toolbar render
  immediately, and the toolbar stays disabled until the image size is known.
- **Image fails to load:** a destructive `Alert` reading "Couldn't load the document preview", with
  an **Open original** button.
- **No preview image, but a file exists:** "No preview for this file", with **Open original**. Today
  this case renders nothing.
- **No image and no file:** the triggers stay disabled, as they are today, so the viewer never opens
  empty.

## Entry points

Callers stop owning a drawer and `opened` state. They ask the shared viewer to show a document by
passing its id, image URL, file URL and title.

| Call site                                                                                            | Trigger                  | New behaviour                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| `documents-table/cells/preview.tsx`                                                                  | Thumbnail click          | Docked, swapping if already open, with the row highlighted |
| `documents-table/cells/files.tsx`                                                                    | "View image" icon button | Same                                                       |
| `documents-table/document-actions-menu.tsx`                                                          | "View Image" menu item   | Same                                                       |
| `common/forms/edit-document.tsx` (via `EditDocumentModal`, also opened from `documents-gallery.tsx`) | Opening the edit sheet   | Embedded split. The thumbnail and drawer are removed.      |
| Any of the above inside a modal (`RecentDocsOfSameType`)                                             | Same                     | Overlay sheet above the modal                              |

**Later adopters (decision 18, follow-up issue):** the VAT monthly report thumbnails and the
charge-matching `charge-detail-card.tsx` currently link to the raw image in a new tab. They could
open the Docked viewer instead.

## Accessibility

- **Docked** is a labelled `region` ("Document viewer: Invoice 1042"). Opening it does not steal
  focus. The trigger gets `aria-expanded`.
- **Overlay** is a `dialog`. Focus moves into it on open and returns to the trigger on close.
- The image `alt` is the document title.
- Zoom changes are announced politely (`aria-live`).
- With `prefers-reduced-motion`, the panel does not slide or animate the zoom.

## Priorities

- **Must (fixes the issue):**
  - The three presentations.
  - The default widths and readability target.
  - Fit width, fit page and 100%; zoom; scroll and pan with nothing cut off.
  - Open original.
  - Loading and error states.
  - The magnifier as an opt-in toggle.
  - No focus trap and no drag-to-dismiss conflict.
  - Single instance.
- **Should:**
  - Remembered widths and split ratio.
  - The ‹ › stepper with active row.
  - Rotate.
  - Keyboard shortcuts.
  - Live URL preview in the edit form.
  - Save & next in the edit sheet.
- **Later:**
  - Multi-page PDFs inside the viewer. `imageUrl` is the Cloudinary upload with its extension
    swapped to `.jpg` (`server/src/modules/app-providers/cloudinary.ts`), so it shows page 1 only.
  - Two ways in: Cloudinary's `pg_N` and `dn_<dpi>` options on the same URL would give a page
    switcher and sharper zoom without new storage. `pdfjs-dist` is already a client dependency, used
    by `issue-document/pdf-viewer.tsx`.
  - Annotations, and linking OCR'd fields to their position on the page.

## Notes for whoever implements it (constraints, not a design)

- Width persistence: reuse `hooks/use-persistent-state.ts`. It already guards storage access and
  validates stored values.
- Segmented control: `@radix-ui/react-toggle-group` ships inside the existing `radix-ui` package, so
  it needs no new dependency. A plain pointer-drag handle is enough for resizing, so
  `react-resizable-panels` isn't required.
- The viewer canvas must opt out of vaul dragging (`data-vaul-no-drag`) while it lives inside the
  bottom edit sheet.
- The Docked presentation needs the Zustand store (decision 8) plus a slot in the dashboard layout.
  The Overlay is a nested Radix Dialog above `z-1001` (decision 12).
- `PopUpDrawer` declares `modalSize`, `style`, `padding` and `lockScroll`, then ignores them. That
  is worth cleaning up when the edit sheet changes.
- No component tests exist for any of this today. New tests follow the client convention of
  `createRoot` + `act` under happy-dom.

## Acceptance criteria (from the issue, made measurable)

1. On a 1440×900 screen with the sidebar open, an A4 invoice opens with at least 600px of page width
   and is readable without the magnifier. This holds both from a documents table (Docked) and in the
   edit sheet (Embedded).
2. While the viewer is open, every field of the edit form is visible and can be typed into.
3. A tall receipt scan can be scrolled to its bottom. "Fit page" shows it whole. No part is clipped
   at any zoom.
4. Opening a second document from the same table replaces the first, with no stacking.
5. Below 1024px, the viewer is full screen with pinch zoom and no swipe-to-dismiss. It is no worse
   than today's 75%-wide drawer.

## Verification

- Every PR runs `yarn test:client`, `tsc --noEmit` for the client, `yarn lint` and
  `yarn prettier:check`, plus the manual QA matrix in decision 19.
- Acceptance criterion 3 is met after PR 1, criterion 4 after PR 2, criteria 1 and 2 after PR 3, and
  criterion 5 after PR 4.
