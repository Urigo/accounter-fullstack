---
'@accounter/client': minor
---

The document viewer now works on phones and above dialogs. Below 1024px it opens full screen, with
pinch zoom, double-tap, pan and a light glide after a swipe (off under reduced motion), and drags
never swipe it away. The browser's Back button closes it without leaving the page, and ✕ leaves no
extra history entry behind. Opened from a table inside a dialog, such as the recent documents in
the issue-document dialog, it opens as a sheet on the right with the dialog still visible on the
left; Esc closes only the sheet and focus returns into the dialog. The same sheet replaces the old
drawer when the screen is too narrow to dock the viewer. In the edit sheet below 1024px, Expand now
opens the document full screen. The toolbar condenses in a narrow viewer, with the magnifier moving
into a ⋯ menu. The old document drawer is gone.
