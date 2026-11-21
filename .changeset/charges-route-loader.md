---
'@accounter/client': patch
---

All Charges shows its first rows sooner on a cold load: a route loader starts the list query as soon
as the app has a token, instead of waiting for the lazy screen to mount (about 300 ms later, because
React holds a resolved Suspense boundary back), and the screen takes over the request in flight.
