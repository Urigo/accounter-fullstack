---
'@accounter/client': patch
---

Annual audit step 1 (Validate All Charges) no longer reports "1 need attention" when the charge
counts were never fetched. With a manual override saved, the counts are not loaded automatically,
so the step now shows "Not checked" until Revalidate or Refresh is pressed; Refresh was also stuck
disabled in that state. "Review Charges" opens the filtered charges list in a new tab.
