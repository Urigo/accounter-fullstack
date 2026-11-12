---
'@accounter/client': patch
---

Stop the Tax Category and Business Trip columns in the All Charges table from being squeezed to a
few letters per line. They no longer break words anywhere (the Tags column got the same fix
earlier). Only the counterparty and description cells keep the break-anywhere rule now, with a
floor width so ordinary names still wrap at spaces and only a long unbroken token breaks inside.
