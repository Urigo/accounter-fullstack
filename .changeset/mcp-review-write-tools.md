---
'@accounter/mcp-server': minor
---

Add the six MCP write tools a charge review needs to apply its decisions directly, instead of
handing back a to-do list for the Accounter UI. All sit behind the existing `MCP_ENABLE_WRITE_TOOLS`
flag (off by default), require `business_owner`/`accountant`, target exactly one business, are
audit-logged and are never retried — the same guards as `accounter_update_charges_tags`.

- `accounter_update_charge` — edit a charge's `userDescription`, `type`, `optionalDocuments`,
  `optionalVat`, `isInvoicePaymentDifferentCurrency`, `defaultTaxCategoryId`, `businessTripId`
  and `yearsOfRelevance`. Rejects `counterpartyId` on purpose: upstream derives a
  charge's counterparty from its transactions and documents (the schema field exists but the
  resolver ignores it), so the tool points at the two tools that do set it.
- `accounter_merge_charges` — fold 1–20 charges into a base charge (`mergeCharges`), the fix for an
  emailed receipt that landed in its own charge next to the card row it pays for. Refuses a
  self-merge or duplicate ids before any round trip.
- `accounter_update_transactions` — set `counterpartyId`, `chargeId` and/or `isFee` on 1–50
  transactions in one upstream batch (`updateTransactions`); this is where a charge's counterparty
  is actually set, and `chargeId` is how a wire is moved onto the charge holding its invoice.
  Former charges the move leaves empty are deleted by the server and reported under
  `deletedChargeIds`.
- `accounter_update_document` — move a document to another charge (an emptied former charge is
  deleted and reported as `deletedChargeId`) and/or fix `creditorId`, `debtorId`, `documentType`, `serialNumber`, `date`, `amount`,
  `vat`, `description` (`updateDocument`).
- `accounter_delete_document` — delete a document (`deleteDocument`), reporting the charge it
  came off and whether that charge was deleted with it.
- `accounter_create_business` — add a directory entry (`insertNewBusiness`) with every
  `InsertNewBusinessInput` field (`country` validated against the server `CountryCode` enum), so a
  new vendor can be set as a counterparty in the same session. Refuses a name that already exists
  (returning the existing id) unless `allowDuplicateName`, since the upstream insert is not atomic
  and a retry would otherwise duplicate the entity.

Each tool is a thin wrapper over one existing server mutation: no schema or resolver changes. Covered
by per-tool unit tests, the registry-wide scope-forwarding, usage-log and description contracts,
and the e2e exposure checks (hidden by default, listed after every read tool when enabled).
