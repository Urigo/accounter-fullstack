---
'@accounter/client': patch
---

Fit the dynamic report's expanded leaf transactions table to the report panel. The report tree sizes
itself to its widest content, which included the table at its unwrapped width, so the whole tree
scrolled sideways and the Reference and Details columns never wrapped. The table now takes the
panel's width, and its columns wrap. If the table still can't fit, only the table scrolls
sideways, not the tree.
