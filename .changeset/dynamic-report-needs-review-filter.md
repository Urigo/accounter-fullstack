---
'@accounter/client': patch
---

Dynamic report: add a "Needs review" toolbar switch, persisted as `?review=1`, that filters the
report tree to non-approved leaves and their ancestors, force-expanded on screen. Branch sums stay
unfiltered, and the template's saved expansion state is never changed by the filter.
