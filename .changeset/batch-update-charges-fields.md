---
'@accounter/server': minor
'@accounter/mcp-server': minor
---

- **Server**: new `updateChargesFields(updates: [ChargeFieldsUpdateInput!]!)` mutation that sets
  each listed charge's own `userDescription` and/or `type` in one statement (up to 500 charges).
  The list is validated as a whole before anything is written; a type change degrades accountant
  approval, a description change does not.
- **MCP**: new write tool `accounter_update_charges` over it, taking up to 50
  `{ chargeId, userDescription?, type? }` entries per call, so a categorisation pass no longer
  needs one `accounter_update_charge` call per charge.
