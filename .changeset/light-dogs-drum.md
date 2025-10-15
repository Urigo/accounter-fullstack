---
'@accounter/server': patch
---

- **Gmail Listener Implementation**: Introduced core functionality to listen for Gmail notifications
  using Google Cloud Pub/Sub, enabling real-time email processing.
- **Comprehensive Setup Guide**: Added `GMAIL_LISTENER.md` with detailed steps for Google Cloud
  project setup, API enablement, service accounts, Pub/Sub topics, OAuth2 credentials, and
  environment variables.
- **Modular Service Architecture**: Implemented `GmailService` for email interaction and
  `PubSubService` for handling incoming notifications, ensuring a clean separation of concerns.
- **OAuth2 Troubleshooting Utility**: Included a `troubleshootOAuth` function to assist with
  debugging common OAuth2 and Gmail watch permission issues, simplifying the setup process.
- **Alternative Polling Mechanism**: Provided a documented fallback polling approach for scenarios
  where Pub/Sub integration might be overly complex or not feasible.
