---
'@accounter/client': patch
---

Fix the dynamic report's Template Manager dialog, whose templates table overflowed past the dialog's
edge: the dialog now actually widens to `2xl` (the base dialog's `sm:max-w-lg` was overriding it),
the table is kept inside it with horizontal scroll as a fallback, and a long template list scrolls
within the dialog instead of running off-screen.
