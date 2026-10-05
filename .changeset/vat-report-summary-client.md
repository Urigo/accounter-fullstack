---
'@accounter/client': minor
---

The VAT report summary card now shows the server's `summary`: the month's totals exactly as filed in
the PCN874 header.

The card used to reduce the report rows itself, with its own definitions: taxable sales included
zero-VAT rows, "Equipment Inputs" was the pre-VAT amount of property expenses, and the total VAT
subtracted every expense row, including the entry types the PCN874 header leaves out. It now reads
`VatReportResult.summary` and computes nothing on its own.

Labels follow the PCN874 meaning of each figure. "Taxable Sales Total" is now "Taxable Sales
Amount", "Equipment Inputs" is now "Equipment Inputs VAT" (a VAT amount, as filed), and "Total VAT
Amount" is now "Total VAT", marked as to pay or to receive. The card also shows "Other Inputs VAT"
and the sales and input record counts, and takes the currency from the server instead of assuming
ILS.

Expect the numbers to change for some months. That is intended: where the card and the generated
PCN874 file disagreed, the card now shows what is filed. The summary always covers the whole month,
so it no longer changes with the charge type filter, and the card says so.
