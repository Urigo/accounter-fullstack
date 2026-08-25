# Charges Filters — Redesign Prompt

Copy everything below the divider into v0 / Lovable / Base44 / any other UI generation tool. It is
self-contained: it carries the design system, the full filter inventory, and the new requirements,
so the tool needs no access to this repository.

---

## Task

Redesign the **filter panel for a charges table** in an accounting web app.

I'll give you the app's design system, every filter that must exist, and a set of new requirements.
**The current design is bad and you should not reproduce its structure** — I'm giving it to you only
so you know what you're replacing. Grouping, ordering, container type, and interaction model are all
yours to decide.

### Stack — please follow exactly

- **React 19 + TypeScript**. Functional components, named exports, return type `ReactElement`.
- **Tailwind CSS v4** (CSS-first config, no `tailwind.config.js`).
- **shadcn/ui**, style `new-york`, base color `gray`, CSS variables on.
- **`lucide-react`** for icons — it is the app's only icon library.
- **`react-hook-form` + `zod` + `@hookform/resolvers/zod`**, using the shadcn `Form` / `FormField` /
  `FormItem` / `FormLabel` / `FormControl` / `FormMessage` wrapper set.
- **Do not use Mantine, MUI, Ant Design, Chakra, or any other component kit.** The app is actively
  migrating off Mantine; anything Mantine-based is unusable to me.
- **No network calls.** Mock every option list as a local `const` with realistic sample data.
- Prefer core Tailwind utilities (`h-64`, `p-4`, `size-5`) over arbitrary values (`h-[500px]`).
- Optimize for **light mode**. The app defines dark tokens but never mounts a theme provider, so
  dark mode is currently dormant — don't let it drive the design.

---

## 1. Design system

### Theme tokens (verbatim from the app's `index.css`)

```css
@theme {
  --color-background: #fff;
  --color-foreground: oklch(13% 0.028 261.692); /* gray-950 */

  --color-card: #fff;
  --color-card-foreground: oklch(13% 0.028 261.692);

  --color-popover: #fff;
  --color-popover-foreground: oklch(13% 0.028 261.692);

  --color-primary: oklch(21% 0.034 264.665); /* gray-900 */
  --color-primary-foreground: oklch(98.5% 0.002 247.839); /* gray-50 */

  --color-secondary: oklch(96.7% 0.003 264.542); /* gray-100 */
  --color-secondary-foreground: oklch(21% 0.034 264.665);

  --color-muted: oklch(96.7% 0.003 264.542);
  --color-muted-foreground: oklch(55.1% 0.027 264.364); /* gray-500 */

  --color-accent: oklch(96.7% 0.003 264.542);
  --color-accent-foreground: oklch(21% 0.034 264.665);

  --color-destructive: oklch(57.7% 0.245 27.325); /* red-600 */
  --color-destructive-foreground: oklch(98.5% 0.002 247.839);

  --color-border: oklch(92.8% 0.006 264.531); /* gray-200 */
  --color-input: oklch(92.8% 0.006 264.531);
  --color-ring: oklch(70.7% 0.022 261.325); /* gray-400 */
}
```

The palette is deliberately neutral — near-black on white, gray-100 for muted surfaces, gray-200
borders. There is no brand accent color. If you introduce one, keep it to a single accent used
sparingly and say so in your rationale.

### Typography and shape

- Font: **Roboto, sans-serif**, base size **14px**.
- **There is no `--radius` token.** Radii are chosen per component:
  - `rounded-md` — buttons, inputs, badges, select triggers
  - `rounded-lg` — grouped panels, bordered list containers
  - `rounded-xl` — `Card`
  - `rounded-full` — pill chips
- Icons are sized `size-4` or `size-5` inline with text.

### Available shadcn/ui components

```
accordion  alert  alert-dialog  avatar  badge  button  calendar  card  chart  checkbox
collapsible  command  dialog  drawer  dropdown-menu  empty  field  form  input  input-group
label  pagination  popover  progress  scroll-area  select  separator  sheet  skeleton
sonner  spinner  switch  table  tabs  textarea  toggle  tooltip
```

**Not available** (you must compose these yourself, as the app does): `slider`, `radio-group`,
`sidebar`, `combobox`, `multi-select`, `date-picker`. Descriptions of the app's hand-rolled versions
follow — match their behaviour so your output drops in.

### The app's multi-select (match this)

A `Popover` whose trigger is a bordered box (`min-h-10 h-auto rounded-md border`). The popover
content is a `cmdk` `Command` with a search input, and each option row has a checkbox square plus
its label. Behaviours:

- A **"(Select All)"** row at the top.
- A footer row with **Clear** and **Close** actions.
- Selected values render in the trigger as `Badge` chips.
- When selections overflow, show the first few plus a **`+ N more`** badge whose `Tooltip` lists the
  rest.
- Option shape is always
  `{ label: string; value: string; description?: string; icon?: LucideIcon }`.
- The lists are long (hundreds of financial entities), so search is mandatory. The app's placeholder
  string is literally `"Scroll to see all options"` — you may improve on that wording.
- Selects are **disabled while their option list is loading**.

### The app's date input (match this)

A text input accepting `YYYY-MM-DD`, wrapped in an `InputGroup` with a trailing ghost icon button
(lucide `Calendar`) that opens a `Popover` containing the shadcn `Calendar` in `mode="single"`.
`ArrowDown` in the input opens the calendar. Invalid input shows `Date must use YYYY-MM-DD format.`
in `text-destructive text-xs`.

### Surrounding chrome (so your trigger fits its context)

- The page is a **data table of charges** on a `bg-gray-100` background.
- A fixed top header: `h-14`, `bg-white/95 backdrop-blur-sm border-b`, with a logo, page title, and
  user menu. A collapsible left sidebar (`w-[240px]`, collapses to `w-[72px]`).
- **The filter trigger currently lives in a fixed bottom footer bar** (`h-14`, contents centered),
  alongside table pagination. You may keep it there, move it into a toolbar above the table, or
  propose something else — but say where you put it and why.
- Responsive range: **1400px down to mobile.** The app's grids collapse 3 → 2 → 1 columns at 980 /
  900 / 755 / 600px.

---

## 2. The current design (what you are replacing)

Do **not** copy this. It is here purely as context.

- Trigger: a `Button variant="outline" size="icon"` with a lucide `Filter` glyph, wrapped in an
  indicator that shows a small dot when any filter is active. No indication of _which_ filters are
  active or how many.
- Container: an extra-large modal.
- Body: a flat **two-column grid** of 11 controls in no meaningful order — Owners, Financial
  Entities, Tags, From Date, To Date, Income/Expense, Charge Type, Business Trips, Sort field,
  Accountant Status, Free Text — followed by a single bordered box labelled "Missing Information:"
  containing **8 toggle switches** stacked vertically.
- Footer: three raw `<button>` elements with hardcoded colors — indigo "Filter", orange "Clear",
  rose "Cancel" — none of which use the theme tokens.

Its specific failures, which your redesign should fix:

1. ~25 controls presented at identical visual weight, with no hierarchy or grouping.
2. No conditional logic — every control is always visible, even when irrelevant.
3. No feedback about what is currently filtering the table, and no way to clear one filter.
4. The toggle box is a dumping ground of unrelated booleans.
5. Non-token button colors that clash with the otherwise neutral palette.

---

## 3. Complete filter inventory

Every one of these must exist in the redesign. The `field` column is the exact key in the app's
filter object — **please use these key names in your generated code** so it drops into the real app.

### Entity / relationship filters

| Label              | Field                 | Control      | Options                                                                                            |
| ------------------ | --------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| Owners             | `byOwners`            | multi-select | Financial entities. Which of _my_ businesses the charge belongs to.                                |
| Financial Entities | `byBusinesses`        | multi-select | Same list, different meaning: the **counterparty** — the other party on the charge, not the owner. |
| Financial Accounts | `byFinancialAccounts` | multi-select | **NEW** — see §4.3                                                                                 |
| Tags               | `byTags`              | multi-select | Hierarchical tags — see below                                                                      |
| Business Trips     | `byBusinessTrips`     | multi-select | **Conditionally visible** — see §4.1                                                               |

### Date range

| Label     | Field         | Control | Notes                                                        |
| --------- | ------------- | ------- | ------------------------------------------------------------ |
| From Date | `fromAnyDate` | date    | `yyyy-MM-dd` string. Matches charges _active in_ the period. |
| To Date   | `toAnyDate`   | date    | `yyyy-MM-dd` string.                                         |

Default range is **one year ago → today**. One screen in the app opens with **no date range at all**
(so that old unresolved charges aren't hidden), so the design must look right with the range empty.
Date presets ("Last 30 days", "This quarter", "This year") would be a welcome addition.

### Classification

| Label             | Field              | Control       | Options                                        |
| ----------------- | ------------------ | ------------- | ---------------------------------------------- |
| Income / Expense  | `chargesType`      | single select | `ALL` \| `INCOME` \| `EXPENSE` (default `ALL`) |
| Charge Type       | `byChargeTypes`    | multi-select  | 11 values, table below                         |
| Accountant Status | `accountantStatus` | multi-select  | `APPROVED` \| `PENDING` \| `UNAPPROVED`        |

Charge type values → labels:

| Value                | Label              |
| -------------------- | ------------------ |
| `BANK_DEPOSIT`       | Bank Deposit       |
| `BUSINESS_TRIP`      | Business Trip      |
| `COMMON`             | Common             |
| `CONVERSION`         | Conversion         |
| `CREDITCARD_BANK`    | Credit Card Bank   |
| `DIVIDEND`           | Dividend           |
| `FINANCIAL`          | Financial          |
| `FOREIGN_SECURITIES` | Foreign Securities |
| `INTERNAL`           | Internal Transfer  |
| `VAT`                | Monthly VAT        |
| `PAYROLL`            | Salary             |

Accountant status options carry color and icon (keep this — it's a recognisable visual language in
the app):

| Value        | Label      | Icon (lucide) | Color             | Hover bg             |
| ------------ | ---------- | ------------- | ----------------- | -------------------- |
| `APPROVED`   | Approved   | `Check`       | `text-green-600`  | `hover:bg-green-50`  |
| `PENDING`    | Pending    | `Clock`       | `text-yellow-600` | `hover:bg-yellow-50` |
| `UNAPPROVED` | Unapproved | `X`           | `text-red-600`    | `hover:bg-red-50`    |

### Search

| Label     | Field      | Control | Validation                         |
| --------- | ---------- | ------- | ---------------------------------- |
| Free Text | `freeText` | text    | Minimum 2 characters if non-empty. |

It searches across the charge's description, its transactions' descriptions and references, and its
documents' descriptions, remarks and serial numbers.

### Data-completeness toggles (8 booleans)

These currently sit in one undifferentiated box. They are really two different ideas — _missing
data_ and _state_ — so feel free to split or rethink them.

| Label                 | Field                     | Tooltip                                                                                         |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| Without Invoice       | `withoutInvoice`          | —                                                                                               |
| Without Receipts      | `withoutReceipt`          | —                                                                                               |
| Without Documents     | `withoutDocuments`        | —                                                                                               |
| Without Transactions  | `withoutTransactions`     | —                                                                                               |
| Without Ledger        | `withoutLedger`           | —                                                                                               |
| With Open Documents   | `withOpenDocuments`       | "Show only charges with documents that are currently open"                                      |
| Missing Counterparty  | `withMissingCounterparty` | "Show charges with a transaction missing a business, or a document missing a creditor / debtor" |
| Unbalanced businesses | `unbalanced`              | —                                                                                               |

### Sorting

| Label            | Field          | Control                                                                        |
| ---------------- | -------------- | ------------------------------------------------------------------------------ |
| Field to sort by | `sortBy.field` | single select: `DATE` (Date) \| `AMOUNT` (Amount) \| `ABS_AMOUNT` (Abs Amount) |
| Direction        | `sortBy.asc`   | boolean — `true` = ascending, `false` = descending                             |

Default: `DATE`, descending. The direction control is **disabled until a sort field is chosen**.
Sorting is arguably not a filter — if you think it belongs somewhere other than inside the filter
panel, propose that, but it must remain reachable.

### Sample option data (use something like this for your mocks)

```ts
const OWNERS = [
  { value: 'own-1', label: 'The Guild Ltd' },
  { value: 'own-2', label: 'Uri Goldshtein' }
]

const FINANCIAL_ENTITIES = [
  { value: 'fe-1', label: 'Google Ireland Ltd' },
  { value: 'fe-2', label: 'Amazon Web Services' },
  { value: 'fe-3', label: 'Bank Hapoalim' },
  { value: 'fe-4', label: 'Vercel Inc.' },
  { value: 'fe-5', label: 'מס הכנסה' } // the app has Hebrew/RTL content mixed in
  // …assume ~400 more
]

// description is the tag's ancestry path
const TAGS = [
  { value: 'tag-1', label: 'Travel', description: 'Business > Travel' },
  { value: 'tag-2', label: 'Software', description: 'Business > Software' },
  { value: 'tag-3', label: 'Salaries', description: 'Business > Payroll > Salaries' },
  { value: 'tag-4', label: 'Personal', description: undefined }
]

const BUSINESS_TRIPS = [
  { value: 'bt-1', label: 'GraphQL Conf 2025 — San Francisco' },
  { value: 'bt-2', label: 'JSNation 2025 — Amsterdam' }
]
```

Tag rendering detail worth preserving: in the dropdown the **ancestry path renders above the tag
name**, in `text-xs opacity-65`, with the name below in `text-sm`. Search matches the name **or**
the path.

---

## 4. New requirements

These are the reason for the redesign. All four are mandatory.

### 4.1 Business Trips is conditionally visible

The **Business Trips** picker must only appear when **Charge Type** includes `BUSINESS_TRIP`. It is
meaningless otherwise.

Decide and state: how the control appears/disappears (animated reveal, collapse, disabled state),
and what happens to an already-selected trip when the user removes `BUSINESS_TRIP` from Charge Type
— clear it silently, keep it, or warn.

### 4.2 Owners is conditionally visible

The **Owners** picker must only render when its option list has **more than one** entry. Most
tenants have a single business, where the control is pure noise. Handle both states without leaving
a gap or a reflow jump in the layout.

### 4.3 Financial Accounts filter (new control)

A new multi-select over the tenant's financial accounts. There are five account types, each with an
icon and a display convention:

| Type                   | Label                | Icon (lucide) | Example display           |
| ---------------------- | -------------------- | ------------- | ------------------------- |
| `BANK_ACCOUNT`         | Bank Account         | `Building2`   | `Bank Account 12-456789`  |
| `CREDIT_CARD`          | Credit Card          | `CreditCard`  | `Credit card **1234`      |
| `CRYPTO_WALLET`        | Crypto Wallet        | `Bitcoin`     | `Crypto Wallet …a19f3c2b` |
| `BANK_DEPOSIT_ACCOUNT` | Bank Deposit Account | `Building2`   | `Deposit 12-456789/03`    |
| `FOREIGN_SECURITIES`   | Foreign Securities   | `Building2`   | `IBKR U1234567`           |

Underlying data: a bank account carries a **bank number, branch number and account number**; a
credit card carries only its **last four digits**; a crypto wallet has a long address usually
truncated to its last 8 characters. Accounts also have an optional human-given name, which should
take precedence over the generated label when present.

Grouping the dropdown by account type, with the type icon on each row, would be an improvement over
a flat list — your call.

### 4.4 Negative (exclusion) filters

Four dimensions need an "exclude these" mode as well as "include these":

- **Financial Entities** (`byBusinesses`)
- **Financial Accounts** (`byFinancialAccounts`)
- **Tags** (`byTags`)
- **Free Text** (`freeText`)

Semantics: _show charges that do **not** match these values._

**The mechanism is your call.** Two candidates, both acceptable:

1. **Per-value ± chips** — one picker per dimension; each selected chip is individually marked
   include (`+`) or exclude (`−`), and clicking a chip flips it. Compact, but the two modes must be
   unmistakably distinguishable at a glance.
2. **Paired include/exclude inputs** — an explicit "Financial Entities" and "Exclude Financial
   Entities" control. More obvious, but doubles the visible control count on a panel that already
   has too many.

Relevant precedent from elsewhere in the same app: its Balance Report filter uses paired inputs
(`includedTags`/`excludedTags`, `includedCounterparties`/`excludedCounterparties`,
`includedAccounts`/`excludedAccounts`) and **disables the exclude input whenever the include list is
non-empty**, treating the two as mutually exclusive per dimension. Either adopt that rule or allow
both simultaneously — but say which you chose and why.

**Free text is different**: it's a single string, not a list, so its negation is a mode toggle —
"contains" vs. "does not contain" — rather than a second list. Design it accordingly.

---

## 5. Interaction requirements

- **Show what's active.** A user must be able to see which filters are currently applied without
  opening the panel, and remove an individual filter without opening it. Today there is only a dot.
  Removable chips in the toolbar are one obvious answer; propose whatever you think is best.
- **Commit semantics.** Today: **Apply** commits the form, **Clear** resets to a completely empty
  filter (note: empty, _not_ back to defaults), **Cancel** discards edits and closes. You may
  replace this with live-apply plus a Reset — but state explicitly which model you chose, and make
  sure the "clear everything" action is still reachable and distinguishable from "reset to
  defaults".
- **Grouping and progressive disclosure.** ~25 controls is too many for one flat surface. Group them
  deliberately and explain the grouping in your rationale. Consider which controls are used on every
  visit versus once a month, and treat them differently.
- **Loading states.** Option lists load asynchronously. Individual selects are disabled while their
  list loads, and the apply action is blocked until the entity and tag lists have resolved. Design a
  skeleton or disabled state that doesn't cause layout shift.
- **Accessibility.** Every control has an associated label; invalid fields get `aria-invalid`;
  pickers are fully keyboard navigable; the panel traps focus if it is modal.
- **Responsive** from 1400px down to mobile.

---

## 6. Data contract

All filter state serializes into a single flat JSON object that is stored in the URL query string.
**Everything must be plain-JSON representable** — no `Date` objects, no `Map`s, no `Set`s, no
symbols. Dates are `yyyy-MM-dd` strings.

Here is the existing shape. Extend it with whatever new keys your exclusion design implies (e.g.
`excludedBusinesses`, `excludedTags`, `excludedFinancialAccounts`, `freeTextMode`) and show the
extended type in your answer:

```ts
type TimelessDateString = string // 'yyyy-MM-dd'

type ChargeFilter = {
  // dates
  fromAnyDate?: TimelessDateString
  toAnyDate?: TimelessDateString

  // entities (UUID strings)
  byOwners?: string[]
  byBusinesses?: string[]
  byFinancialAccounts?: string[]
  byTags?: string[]
  byBusinessTrips?: string[]

  // classification
  chargesType?: 'ALL' | 'INCOME' | 'EXPENSE'
  byChargeTypes?: Array<
    | 'BANK_DEPOSIT'
    | 'BUSINESS_TRIP'
    | 'COMMON'
    | 'CONVERSION'
    | 'CREDITCARD_BANK'
    | 'DIVIDEND'
    | 'FINANCIAL'
    | 'FOREIGN_SECURITIES'
    | 'INTERNAL'
    | 'VAT'
    | 'PAYROLL'
  >
  accountantStatus?: Array<'APPROVED' | 'PENDING' | 'UNAPPROVED'>

  // search
  freeText?: string

  // completeness toggles
  withoutInvoice?: boolean
  withoutReceipt?: boolean
  withoutDocuments?: boolean
  withoutTransactions?: boolean
  withoutLedger?: boolean
  withOpenDocuments?: boolean
  withMissingCounterparty?: boolean
  unbalanced?: boolean

  // sorting
  sortBy?: { field: 'DATE' | 'AMOUNT' | 'ABS_AMOUNT'; asc?: boolean }
}
```

Defaults on open: `byOwners` prefilled with the signed-in user's own business; date range one year
ago → today; sort `DATE` descending.

---

## 7. Constraints to design around

Facts about the backend, so you don't assume capabilities that don't exist. **You should design as
if all of these work** — wiring them up is separate work on my side — but knowing them may affect
how you present things:

- `byFinancialAccounts` exists in the API schema but is currently ignored by the query layer. Same
  for `unbalanced`.
- The accounts endpoint currently returns only `{ id, name }`. The richer fields (type, last four
  digits, bank/branch numbers) exist in the schema but aren't fetched yet, so the labelled/grouped
  account picker in §4.3 needs a data change first.
- **No exclusion filter of any kind exists in the API today.** All four negative filters in §4.4 are
  net new on both client and server. If your design implies a particular request shape, spell it out
  so I can build the matching API.
- Tag values are UUID strings, despite the field reading like it takes names.
- Three further fields exist in the schema and are **intentionally not in this design**: `fromDate`
  / `toDate` (a stricter date match — the charge's own main date must fall inside the range, whereas
  the `fromAnyDate` / `toAnyDate` pair in §3 matches any charge _active during_ the range, which is
  what users actually want), and a legacy singular `businessTrip` superseded by `byBusinessTrips`.
  Don't add controls for them.

---

## 8. What I want back

1. A **single self-contained React + TypeScript component file** (plus small sub-components if
   needed), with all mock data inline, that renders and works standalone.
2. A short **written rationale** covering:
   - how you grouped the ~25 controls and why
   - which negative-filter mechanism you chose and why
   - where you put the trigger and how active filters are surfaced
   - which commit model you chose (apply-on-submit vs. live)
3. If you can produce variants: **two distinct layout directions** rather than one polished answer —
   e.g. one that keeps a modal and one that uses a persistent side panel or inline toolbar.
