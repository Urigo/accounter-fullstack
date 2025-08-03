---
'@accounter/client': patch
---

* **Modal Re-rendering Fix**: Prevented unnecessary re-fetching of similar charges data in the `SimilarChargesByIdModal` by modifying the `useEffect` hook's condition. The effect now only triggers the `fetchSimilarCharges` function if the modal is open, `tagIds` or `description` are present, AND `data` is not yet available.
* **`useEffect` Dependency Update**: Updated the `useEffect` dependency array to include `data`. This ensures that the effect correctly accounts for changes in the `data` state, which is crucial for preventing redundant data fetches once the data has been loaded.

