# Gmail Listener

A service that watches a Gmail inbox, extracts financial documents from matching emails, and sends
them to the Accounter server through GraphQL.

## What It Does

- Connects to Gmail using OAuth2.
- Ensures the processing label tree exists (default: `accounter/documents` with `processed`,
  `errors`, and `debug` sub-labels).
- Processes pending emails already under the target label on startup.
- Subscribes to Gmail push notifications through Google Pub/Sub for new inbox events.
- Extracts documents from:
  - PDF/image attachments
  - HTML email body (converted to PDF)
  - Internal links configured per business
- Uploads documents to the Accounter server using GraphQL multipart requests.

## Prerequisites

- Node.js 20+ (project standard)
- Yarn
- A Google account/mailbox to monitor
- Access to an Accounter server with:
  - A valid `GMAIL_LISTENER_API_KEY`
  - `businessEmailConfig` and `insertEmailDocuments` GraphQL operations enabled

## Quick Start

1. Copy env template and fill values:

   ```bash
   cp .env.template .env
   ```

2. Follow full setup instructions in [SETUP.md](./SETUP.md).

3. Run locally:

   ```bash
   yarn
   yarn dev
   ```

## Runtime Behavior

- Startup flow:
  - validates environment variables
  - validates OAuth and Gmail API access
  - creates missing labels
  - processes existing labeled emails
  - starts Pub/Sub listener and Gmail watch
- Email labeling:
  - success -> `<label>/processed`
  - processing error -> `<label>/errors`
  - no relevant documents -> `<label>/debug`
- Health checks run every 10 minutes and the listener auto-restarts on failures.

## Environment Variables

See [SETUP.md](./SETUP.md) for how to obtain each value.

- `SERVER_URL` (required): GraphQL endpoint URL of Accounter server.
- `GMAIL_LISTENER_API_KEY` (required): API key sent as `X-API-Key`.
- `GMAIL_CLIENT_ID` (required for Gmail mode): Google OAuth client ID.
- `GMAIL_CLIENT_SECRET` (required for Gmail mode): Google OAuth client secret.
- `GMAIL_REFRESH_TOKEN` (required for Gmail mode): offline refresh token for the monitored mailbox.
- `GMAIL_LABEL_PATH` (optional): base Gmail label to process. Default: `accounter/documents`.
- `GOOGLE_CLOUD_PROJECT_ID` (required for Gmail mode): GCP project ID used by Pub/Sub.
- `GOOGLE_APPLICATION_CREDENTIALS` (required for Gmail mode): path to service account JSON key file.
- `PUBSUB_TOPIC` (optional): Pub/Sub topic name. Default: `gmail-notifications`.
- `PUBSUB_SUBSCRIPTION` (optional): Pub/Sub subscription name. Default: `gmail-notifications-sub`.

Important: Gmail integration variables are validated as a set. Provide all Gmail-related variables
together, or none.

## Scripts

- `yarn dev` - build in watch mode and run listener
- `yarn build` - typecheck + build
- `yarn start` - run built output
- `yarn typecheck` - TypeScript check only

## Security Notes

- Never commit `.env` or Google service-account JSON keys.
- Root `.gitignore` already excludes `**/accounter-gmail-service-key.json`.
- Keep the OAuth client and refresh token restricted to the monitored mailbox use case.
