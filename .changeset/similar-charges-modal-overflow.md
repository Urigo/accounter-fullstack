---
'@accounter/client': patch
---

Make the Similar Charges dialog (shown after changing a charge's description or tags, or a
business's defaults) wide enough for its table. It was capped at 900px, so the right-hand columns
were cut off; it now takes the table's width up to the window width and scrolls sideways only
beyond that. The "Approve selected" button no longer sits under the close button.
