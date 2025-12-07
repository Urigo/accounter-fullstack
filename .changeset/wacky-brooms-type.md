---
'@accounter/client': patch
'@accounter/server': patch
---

- **GreenInvoiceClient ID Refinement**: The 'id' field has been removed from GreenInvoiceClient type
  definitions and GraphQL fragments across the client and server, standardizing on 'businessId' or
  'greenInvoiceId' as primary identifiers.
- **Frontend Form Logic Enhancement**: The GenerateDocument component now uses a 'formDefaults'
  object for initial state, and 'useEffect' ensures form data resets correctly when
  'initialFormData' changes.
- **Performance Optimizations**: React's 'useCallback' and 'useMemo' hooks have been introduced in
  GenerateDocument to memoize event handlers and computed values, improving rendering performance.
- **Backend Client ID Consistency**: Green Invoice resolvers have been updated to consistently use
  'greenInvoiceClientId' when issuing or previewing documents, ensuring the correct client is
  associated.
