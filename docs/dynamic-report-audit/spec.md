# Dynamic Report — Audit Layer Spec

## Overview

Add a per-node metadata layer to the dynamic report: every node (branch and leaf, in the report
tree) carries a **status**, an optional **note**, and an optional list of **linked documents**.
Metadata is stored inside the template JSON, shared across all users of the same business, and
travels with its node when the node is moved. Changes to metadata mark the template dirty and
require an explicit resave.

---

## Data shape — additions to `node.data`

Three new optional fields on every node (both branches and leaves):

| Field             | Type                                      | Default        |
| ----------------- | ----------------------------------------- | -------------- |
| `status`          | `"unapproved" \| "pending" \| "approved"` | `"unapproved"` |
| `note`            | `string \| null`                          | `null`         |
| `linkedDocuments` | `LinkedDocument[]`                        | `[]`           |

`LinkedDocument` shape:

```
{ type: "uuid" | "url", value: string }
```

### Status semantics

| Value        | Meaning                                |
| ------------ | -------------------------------------- |
| `unapproved` | Default — node has never been reviewed |
| `pending`    | Reviewed but waiting on something      |
| `approved`   | Fully reviewed and signed off          |

- Status is **independent** per node — a branch's status is not derived from its children
- There is no automatic status downgrade on ledger data changes (out of scope for this feature)

---

## Storage

Metadata is stored **inline in the template JSON** as extra fields on each node's `data` object. No
new DB columns or tables are needed.

Metadata **travels with its node** when the node is dragged or moved — it is part of the node object
and moves with it.

Metadata is **shared** across all users of the same business owner (same as the template itself).

---

## Inline node indicators

Every node row (in both the bank and report panels) shows the following indicators on its right side
— **always visible, regardless of edit mode or locked state**:

- **Status badge** — colored pill:
  - Gray: `unapproved`
  - Yellow: `pending`
  - Green: `approved`
- **Note icon** (`MessageSquare`) — shown only when `note` is non-null and non-empty
- **Paperclip icon** (`Paperclip`) — shown only when `linkedDocuments.length > 0`

---

## Node metadata modal

### How to open

Clicking any of the inline indicators (status badge, note icon, paperclip icon) opens the modal. A
dedicated info/edit button on the node row may also open it.

The modal is **always accessible** — not gated on edit mode, and accessible even for locked
templates.

### Modal contents

1. **Node label** — displayed as the modal title (read-only)

2. **Status selector** — segmented control or radio group with three options: `Unapproved` /
   `Pending` / `Approved`

3. **Note** — multiline textarea; placeholder "Add a note…"

4. **Linked documents** — list of currently linked items + an add-document input:

   Each existing item shows:
   - `type: "url"` → raw URL rendered as a clickable external link
   - `type: "uuid"` → description + link **resolved from the server**:
     - Show a loading spinner while the resolution query is in flight
     - On success: render `description` as a clickable link to the document's `url`
     - On failure (UUID not found or error): fall back to displaying the raw UUID as plain text
   - A remove (×) button to delete the item from the list

   **Add document input** — a text input + "Add" button:
   - Accepts either a valid UUID or a full URL (`http://` or `https://`)
   - Type is auto-detected on submit: UUID format → `type: "uuid"`, otherwise → `type: "url"`
   - Appends the new item to the list

5. **Footer buttons**:
   - **Cancel** — discard all unsaved modal edits, close the modal
   - **Save** — apply changes to the node's data in the tree state, mark the template dirty, close
     the modal

Changes are **not applied** until "Save" is clicked. Closing the modal or clicking "Cancel" discards
any in-progress edits.

### Document resolution behavior

Resolution is **lazy** — the `linkedDocumentInfo` query is called when the modal opens (or when a
new UUID is added), not on template load. Each UUID is resolved independently.

---

## Backend changes

### New GraphQL query — `linkedDocumentInfo`

```graphql
type LinkedDocumentInfo {
  id: UUID!
  description: String! # human-readable label (charge description, invoice number, etc.)
  url: String! # deep-link to the document within the app
}

extend type Query {
  linkedDocumentInfo(id: UUID!): LinkedDocumentInfo # returns null if not found
}
```

The resolver should look up the UUID across the relevant document types (charges, invoices, etc.)
and return the best available description and a direct app URL. Returns `null` if not found.

### `DynamicReportNodeData` GraphQL type additions

```graphql
type LinkedDocument {
  type: String!    # "uuid" | "url"
  value: String!
}

# additions to DynamicReportNodeData
status: String!
note: String
linkedDocuments: [LinkedDocument!]!
```

### Zod schema additions (`dynamic-report.helper.ts`)

Add to `dynamicReportNodeData`:

```ts
status: z.enum(['unapproved', 'pending', 'approved']).default('unapproved'),
note: z.string().nullable().default(null),
linkedDocuments: z.array(
  z.object({ type: z.enum(['uuid', 'url']), value: z.string() })
).default([]),
```

---

## Frontend changes

### `types.ts`

Add to `CustomData`:

```ts
status?: 'unapproved' | 'pending' | 'approved';
note?: string | null;
linkedDocuments?: { type: 'uuid' | 'url'; value: string }[];
```

### `custom-node.tsx`

- Render inline status badge (colored by value; default `unapproved` when absent)
- Render note icon when `note` is non-empty
- Render paperclip icon when `linkedDocuments` has items
- Wire a click handler on any indicator (or a dedicated button) to open the metadata modal

### `node-metadata-modal.tsx` _(new file)_

Full modal component implementing all of the above:

- Status selector
- Note textarea
- Linked documents list with resolution + remove
- Add document input with type auto-detection
- Cancel / Save footer

---

## Files affected

| File                                                                            | Change                                                                                                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/modules/reports/typeDefs/dynamic-report.graphql.ts`        | Add `status`, `note`, `linkedDocuments` to `DynamicReportNodeData`; add `LinkedDocument` type; add `linkedDocumentInfo` query |
| `packages/server/src/modules/reports/helpers/dynamic-report.helper.ts`          | Extend Zod schema with three new metadata fields                                                                              |
| `packages/server/src/modules/reports/resolvers/dynamic-report.resolver.ts`      | Implement `linkedDocumentInfo` resolver                                                                                       |
| `packages/client/src/components/reports/dynamic-report/types.ts`                | Add `status`, `note`, `linkedDocuments` to `CustomData`                                                                       |
| `packages/client/src/components/reports/dynamic-report/custom-node.tsx`         | Add inline status badge + note/paperclip icons; wire open-modal handler                                                       |
| `packages/client/src/components/reports/dynamic-report/node-metadata-modal.tsx` | New component — metadata modal (status, note, linked documents)                                                               |
