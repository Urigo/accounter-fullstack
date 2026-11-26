---
'@accounter/client': minor
---

Document previews now open in a column docked to the right of the page instead of a drawer that
covers it, so you can read a scan and work in the table at the same time. By default the column
takes half the space beside the sidebar, or 656px when that is wider, and leaves the page at least
480px. It never gets narrower than 420px, so if the window shrinks after it docks, the page column
gets the rest and scrolls sideways. Resize the column by dragging its left edge or with the arrow
keys there; double-click or Enter resets it. Expand widens it over the page for a close read.
Opening another document swaps it in place and highlights its row. Clicking the active thumbnail
again, pressing Esc inside the viewer, deleting the document or moving to another page closes it.
On screens narrower than 1024px, when the space beside the sidebar is under 900px, and from tables
inside dialogs, the wide drawer is used as before.
