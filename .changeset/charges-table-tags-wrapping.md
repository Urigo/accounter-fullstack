---
'@accounter/client': patch
---

Stop tag names in the All Charges table from breaking mid-word. The previous fix let every text
cell break anywhere, which also let the browser squeeze the Tags, Tax Category and Business Trip
columns down to a few letters per line. Only the counterparty and description cells keep the
break-anywhere rule now, with a floor width so ordinary names still wrap at spaces and only a long
unbroken token breaks inside.
