---
'@accounter/server': patch
---

- **Automatic Gmail Watch Renewal**: The Gmail API watch subscription now automatically renews
  itself one day before its expiration, preventing service interruptions and ensuring continuous
  real-time email processing.
- **Enhanced Health Check**: The `healthCheck` method for the Gmail listener has been upgraded to
  perform an asynchronous call to the Gmail API (fetching user profile) to verify active
  connectivity, providing a more accurate status.
- **Improved Error Handling**: The initial setup of Gmail push notifications now explicitly throws
  an error if it fails, preventing the application from starting in a misconfigured or
  non-functional state.
