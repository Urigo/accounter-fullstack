---
'@accounter/client': patch
---

Keep the All Charges table inside the page: counterparty, description, tag, tax-category and
business-trip cells now let a long unbroken token wrap (`overflow-wrap: anywhere`). Since securities
charges started showing the security business as their counterparty, names such as
`ISHARES_CORE_MSCI_WORLD_UCITS_ETF_...` could not break, the column grew to the token's width, and
the table scrolled sideways instead of fitting the pane.
