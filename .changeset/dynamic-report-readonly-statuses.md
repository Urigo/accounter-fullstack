---
'@accounter/client': patch
---

The dynamic report tree now shows each report row's accountant status, read-only for now. A leaf
shows the status stored in the comparable baseline snapshot, with who set it and when; a stored
approval whose ledger records have changed since reads as pending. A branch shows the worst status of
its visible leaves, with the counts in its tooltip. Bank rows and removed (ghost) rows show no
status.
