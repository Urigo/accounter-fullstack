# @accounter/gmail-listener

## 0.1.0

### Minor Changes

- Initial release of the dedicated Gmail listener service.
- Extracted Gmail inbox watching and financial document ingestion from the main server into a standalone package.
- Added support for:
  - Gmail OAuth2 initialization and label setup
  - Gmail Pub/Sub push notifications
  - Processing pending labeled messages
  - Extracting attachments/body/link-based documents and uploading through GraphQL
