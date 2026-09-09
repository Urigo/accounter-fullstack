---
'@accounter/client': patch
---

Replace Mantine's `NumberInput` with the local `common/inputs/number-input.tsx` across all 33 call
sites, including the shared `CurrencyInput` and `ChargeSpreadInput`.

`modify-document-fields.tsx` already used the local component, so this brings the rest in line. Two
props were added to it for parity, since Mantine rendered both and the `common/forms` call sites
depend on them: `label` (above the field) and `error` (below it, wired to `aria-describedby`). When
neither is given the component renders exactly the markup it did before, so existing call sites that
supply their own `FormLabel`/`FormMessage` are untouched.

Prop translation:

- `precision={n}` → `decimalScale={n}` **plus `fixedDecimalScale`**, since bare Mantine `precision`
  pads to a fixed number of decimals.
- `precision={n}` + `removeTrailingZeros` → `decimalScale={n}` alone. `removeTrailingZeros` has no
  direct equivalent because it is exactly the absence of `fixedDecimalScale` — getting this backwards
  would have padded every currency field with trailing zeros.
- `rightSection="%"` → `suffix="%"`. Every use was a unit string, which is what NumericFormat calls a
  suffix.
- `hideControls` needed no change; the local component already had it.

`common/inputs/currency-input.tsx` and `common/inputs/charge-spread-input.tsx` are now Mantine-free.
The remaining touched files keep other Mantine imports (`Text`, `Select`, `Modal`, `Loader`) that
belong to later clusters.

`CurrencyInput` also stops aligning its two halves with a magic spacer. The currency select
carried `mt-6`, sized to the height of Mantine's label inside the number field; swapping the field
changed that height and left the amount input and the select on different baselines. The label and
error now live on the `CurrencyInput` wrapper, so the two controls are direct flex siblings and line
up by construction, whatever the label does.

Mantine imports: 77 → 75, across 76 → 74 files.
