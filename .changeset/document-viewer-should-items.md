---
'@accounter/client': minor
---

The document viewer can now step through a table's documents. Opened from a documents table, its
header shows a `‹ 3/12 ›` stepper that walks the table in its current sort and filter order (the
current page on the documents report, the charge's own documents inside a charge), and the row
highlight follows. Documents with nothing attached are skipped, and the stepper hides if the
document shown drops out of the table. In the edit sheet, a new Save & next button saves the
document and moves the same sheet on to the next one in the list; if the save fails it stays put
with the edits intact. A new Rotate button turns sideways scans 90° at a time, with the magnifier
following, and resets for each document. Keyboard shortcuts work while a viewer is open, except
while typing: `+`/`-` zoom, `0` fits the width, `1` shows 100%, `R` rotates, `M` toggles the
magnifier and `[`/`]` step. They match the physical keys, so they work with a Hebrew keyboard
layout too, and leave Ctrl/⌘ shortcuts such as browser zoom alone. The docked viewer's width, the
edit sheet's split and whether its document pane is hidden are remembered between visits. Editing
the Image URL field now previews the new image in the edit sheet as soon as it is a valid link.
