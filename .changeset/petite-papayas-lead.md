---
'@accounter/client': patch
---

- **Click propagation fix**: Removed the charge row `onClick` functionality as the row component
  contains multiple internal buttons, resulting in an unstable behaviour
- **DateTimePicker replacement**: Removed Mantine's `DateTimePicker` and replaced it with a new
  `DateTimePickerInput` component built on shadcn primitives. It supports manual text entry in
  `YYYY-MM-DD HH:mm:ss` format (with inline validation), a calendar popup to pick the date, and
  HH/MM/SS spinners for the time — matching the original `withSeconds` behaviour
- **Searchable currency select**: Replaced Mantine's `Select` in `CurrencyInput` with a `Popover` +
  shadcn `Command` component, so users can type a currency code to filter the list instead of
  scrolling through all currencies
