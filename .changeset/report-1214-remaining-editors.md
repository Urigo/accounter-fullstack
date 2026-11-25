---
'@accounter/client': minor
---

The form 1214 page (`/reports/1214`) now edits the rest of the 1214 profile. Related companies and
R&D investments are edited as tables (the form's limits of 3 and 5 are shown as hints, not
enforced), with the R&D total that the report sends as code 165. The amounts section shows each
code's computed value next to its override: add, change or remove overrides (an override of 0 is
kept and suppresses the code; code 165 always follows the R&D investments). A new "Other details"
section edits the attachments, a changed bank account, other taxable income, the capital-gains
appendices summary and a qualifying-company purchase. Each block has its own Save and Cancel, saves
the whole block, shows the server's validation message as is, and refreshes the report's
validation afterwards.
