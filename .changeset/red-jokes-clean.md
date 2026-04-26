---
'@accounter/client': patch
---

- **Legacy Template Migration**: Implemented an in-memory migration helper to automatically convert
  legacy templates to the new explicit-leaf format upon loading.
- **Drag-and-Drop Engine**: Replaced the legacy DnD stack with Pragmatic Drag and Drop, enabling
  robust tree-item hitboxes and cross-tree movement.
- **Tree Data Model**: Refactored the report tree to treat financial entities as explicit leaf
  nodes, ensuring consistent state management and single-presence enforcement.
- **UI/UX Enhancements**: Added a dirty-state confirmation dialog, URL-based filter persistence, and
  a dedicated CSV export feature for the report tree.
