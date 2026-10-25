---
'@accounter/client': patch
'@accounter/server': patch
---

The charge security header now takes its "Foreign" badge from the security business, judged
against the tenant's locality, instead of the bank's raw flag.
`Security.isForeign` is deprecated in favor of `ChargeSecurity.securityBusiness.isForeign`.
