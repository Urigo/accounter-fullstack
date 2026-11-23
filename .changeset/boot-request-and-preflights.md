---
'@accounter/client': patch
'@accounter/server': patch
---

Fewer round trips on every load and page change. The app's boot request now also reads `viewer`,
so the onboarding guard no longer sends its own `Viewer` query (which went out twice per load, the
second time after the boot request). GraphQL operations go to one URL as POST, and the API lets
browsers cache a CORS preflight for two hours, so a new page or filter no longer pays a preflight
round trip before its request.
