---
'@accounter/client': patch
---

Fix back / forward and "Clear all" on the charges and documents pages.

- **Back / forward** now restore the filter and the page together, on All Charges, Missing Info,
  Ledger Validation, Accountant Approvals and Documents. Before, going back after paging or
  re-filtering left the list where it was, and could push a stale entry that wiped the forward
  history.
- **One history entry per change.** Applying a filter used to add two entries (one for the filter,
  one for resetting the page), and Accountant Approvals added one just for being opened.
- **"Clear all" and "Reset" in the charges filters** now clear what they show. A dialog opened over
  an applied filter used to keep fields like owners and the date range in the form state, so Apply
  sent them again.
- Filters in the URL are validated when the page reads them, so a stale or hand-edited link falls
  back to no filter instead of failing the query.

On All Charges, Ledger Validation and Documents, going back to an entry with no filter shows the
unfiltered state again instead of the previous filter's results. On Documents this includes
"Clear", which now empties the list instead of loading every document, the same as opening the page
without a filter.
