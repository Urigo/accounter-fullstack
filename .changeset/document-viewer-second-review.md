---
'@accounter/client': patch
---

Document viewer polish. The row open in the viewer is now outlined instead of tinted, so a row's own
highlight (such as a linked document) stays visible. Pressing Esc while the viewer is expanded in
the edit sheet now shrinks it back instead of closing the sheet and losing unsaved edits. Hiding and
showing the document, or closing the edit sheet over a docked viewer, keeps the scroll position. On
a narrow form pane the edit form drops to a single column, and the edit sheet opens directly in its
side-by-side layout on wide screens. Resize handles no longer cover the scrollbar next to them and
show a clearer focus outline. The browser's Back button reliably closes the full-screen viewer even
when another navigation happened while it opened. A touch glide stops as soon as you zoom. The R
and M shortcuts follow the letter on AZERTY and Dvorak keyboards, and shortcuts no longer fire while
a dropdown, slider or tab is focused. The stepper keeps focus at the first and last document and
announces each step to screen readers. Remembered pane sizes are kept within the same limits while
dragging as after a reload. The Image URL preview waits until the address has a complete host
before loading it. If Save & next runs into an error after saving, it now shows an error message
instead of failing silently. Button labels for screen readers now match their tooltips.
