---
'@accounter/client': patch
---

- **Component Structure**: Reordered the `Button` and `Tooltip` components within the
  `CloseDocumentButton` to ensure correct rendering and interaction.
- **Clickability Fix**: Resolved an issue where the 'Close Document' button was unclickable by
  adjusting the nesting of the `Button` inside the `Tooltip`.
