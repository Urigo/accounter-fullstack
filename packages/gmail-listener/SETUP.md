## Setup Instructions

These instructions are specific to this repository package: `packages/gmail-listener`.

### 1. Google Cloud Project Setup

1. Create or select a Google Cloud project in <https://console.cloud.google.com/>.
2. Enable these APIs in that project:

- Gmail API
- Cloud Pub/Sub API

3. Create a service account for Pub/Sub access:

- IAM & Admin -> Service Accounts -> Create Service Account
- Grant least-privilege Pub/Sub permissions required by your org policy (Editor is not required)
- Create and download a JSON key

4. Save the downloaded JSON key in this package directory as:

- `packages/gmail-listener/accounter-gmail-service-key.json`

5. Ensure Gmail can publish to Pub/Sub topic:

- In Pub/Sub topic permissions, add principal `gmail-api-push@system.gserviceaccount.com`
- Grant role `Pub/Sub Publisher`

Note: this repository already ignores `**/accounter-gmail-service-key.json` in root `.gitignore`.

### 2. Pub/Sub Resources

Create:

- Topic: `gmail-notifications` (or your custom name)
- Subscription: `gmail-notifications-sub` (or your custom name)

You can use custom names, but they must match `PUBSUB_TOPIC` and `PUBSUB_SUBSCRIPTION` in `.env`.

### 3. Gmail OAuth App Setup

1. In Google Cloud Console, go to APIs & Services -> Credentials.
2. Create OAuth 2.0 Client ID credentials.
3. Configure the consent screen according to your organization policy.
4. Keep client ID and client secret for `.env`.

### 4. Generate Refresh Token

Use OAuth Playground:

1. Open <https://developers.google.com/oauthplayground>
2. Click the settings gear and enable "Use your own OAuth credentials"
3. Paste your OAuth client ID and client secret
4. Select scope `https://mail.google.com/`
5. Authorize with the mailbox you want the listener to monitor
6. Exchange authorization code for tokens and copy the refresh token

### 5. Environment Configuration

Create `.env` in `packages/gmail-listener` (or copy from `.env.template`):

```env
# Accounter server GraphQL endpoint
SERVER_URL=https://your-accounter-server/graphql

# API key for X-API-Key header when calling Accounter server
GMAIL_LISTENER_API_KEY=your_api_key

# Gmail OAuth2
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token
GMAIL_LABEL_PATH=accounter/documents

# Google Cloud / PubSub
GOOGLE_CLOUD_PROJECT_ID=your_project_id
PUBSUB_TOPIC=gmail-notifications
PUBSUB_SUBSCRIPTION=gmail-notifications-sub

# Absolute or package-relative path to the service account key JSON
GOOGLE_APPLICATION_CREDENTIALS=./accounter-gmail-service-key.json
```

Important:

- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GOOGLE_CLOUD_PROJECT_ID`, and
  `GOOGLE_APPLICATION_CREDENTIALS` are validated together. Set all of them or none.
- If the process is not started from `packages/gmail-listener`, prefer an absolute path for
  `GOOGLE_APPLICATION_CREDENTIALS`.

### 6. Run the Service

From `packages/gmail-listener`:

```bash
yarn
yarn dev
```

On startup, the listener:

1. validates env
2. validates OAuth access
3. ensures labels exist
4. processes pending labeled messages
5. starts Pub/Sub listening and Gmail watch renewal

### 7. Validate End-to-End

1. Send a test invoice email to the monitored mailbox.
2. Apply/confirm the target label (default `accounter/documents`).
3. Verify logs show processing.
4. Check resulting labels:

- success -> `.../processed`
- failure -> `.../errors`
- no relevant docs -> `.../debug`

## Troubleshooting Notes

- `invalid_grant`: refresh token is invalid/expired or consent screen configuration is incomplete.
- Gmail watch setup errors: verify topic exists and Gmail publisher principal is granted.
- No documents extracted: inspect email attachments/type filters and business email config on server
  side.

## About Polling

This package is implemented with Gmail push notifications + Pub/Sub, not polling. Keep polling as a
fallback design only if infrastructure constraints prevent Pub/Sub usage.
