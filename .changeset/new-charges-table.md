---
"@accounter/client": patch
---

Introduce a new TanStack-Table-based charges table (`NewChargesTable`) on the All Charges screen,
rendering charge rows from a single `ChargeForChargesTableFields` fragment split into dedicated cell
components (amount, counterparty, description, tags, tax category, VAT, business trip, more-info,
type). The new table is mounted under the existing `LoadingOverlay` + stable `chargeNodes` gating so
background refetches no longer blink the view.
