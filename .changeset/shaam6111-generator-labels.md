---
'@accounter/shaam6111-generator': patch
---

Align the code labels and formulas with the 2025 Form 6111:

- The labels of P&L codes 2030-2085, 3020-3120 and 3600-3632 did not match the form's rows (e.g.
  "כיבודים, מתנות, תרומות, קנסות" is 3625, not 3620, and 3040 "תמלוגים (זכויות הפצה)" was
  missing), 2570 read "תגמולים" instead of "תמלוגים", and several tax-adjustment labels had their
  words out of order.
- Code 6666 subtracts financing expenses (5000) per rule 3.1; it added them, so any report with
  financing expenses failed validation.
- Code 370 subtracts 184, as the specification requires.
