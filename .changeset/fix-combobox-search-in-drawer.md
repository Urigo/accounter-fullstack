---
"@accounter/client": patch
---

Fix ComboBox search input being unclickable inside PopUpDrawer (e.g. the Creditor/Debtor selects in
the Edit Document modal). The drawer's underlying Radix Dialog is always modal and traps focus, so
the popover — portaled to `document.body` — could not be focused. PopUpDrawer now exposes its content
element via a portal-container context, and ComboBox portals its popover into it when present while
keeping the default `document.body` portaling everywhere else.
