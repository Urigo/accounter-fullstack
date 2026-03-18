---
'@accounter/gmail-listener': patch
---

- **Dedicated Gmail Listener Service**: The Gmail listener functionality has been extracted from the
  main server into a new, standalone service located in `packages/gmail-listener`. This new service
  is responsible for watching Gmail inboxes, extracting financial documents, and sending them to the
  Accounter server via a new GraphQL API.
