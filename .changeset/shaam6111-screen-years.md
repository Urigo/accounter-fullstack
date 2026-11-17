---
"@accounter/client": patch
---

SHAAM 6111 screen: every closed tax year can be selected (2025 included), and the year comes from
the URL (`?year=`), so annual workflow step 16 opens the year being closed. The comparison year
(`?referenceYear=`) is now fetched and shown, and the business type shows in the header tab.
