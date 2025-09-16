## Setup Instructions

### Step 1: Google Cloud Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable APIs**
   - Enable Gmail API
   - Enable Cloud Pub/Sub API

3. **Create Service Account**
   - Go to IAM & Admin → Service Accounts
   - Create service account with Editor role
   - Download JSON key file

4. **Create Pub/Sub Topic**
   - Go to Pub/Sub → Topics
   - Create topic (e.g., `gmail-notifications`)
   - Create subscription (e.g., `gmail-notifications-sub`)
   - Add principal for `gmail-api-push@system.gserviceaccount.com` with `Pub/Sub Publisher` role

### Step 2: Gmail Setup

1. **Create OAuth2 Credentials**
   - Go to APIs & Credentials → Create Credentials → OAuth 2.0
   - Add your domain and `https://developers.google.com/oauthplayground` to authorized origins
   - Download client configuration

### Step 3: Getting OAuth2 Refresh Token
   - Go to the link https://developers.google.com/oauthplayground. On configure, check `Use your own OAuth credentials` and input your client ID and secret
   - On same page, select `Gmail API v1` and then `https://mail.google.com/`. You will be redirected to your google accounts list, select the email you wish to handle and approve the requested access permissions
   - After this is done, you will be redirected back to the Oauth playground, and receive an authorization code. click 'Exchange authorization code for tokens' (If the 'Step 2' bar shrinks, click it to open again) and save the refresh token


### Step 4: Environment Configuration

Create a `.env` file:

```env
# Gmail OAuth2 Credentials
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=your_domain
GMAIL_REFRESH_TOKEN=your_refresh_token

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your_project_id
PUBSUB_TOPIC=gmail_notifications
PUBSUB_SUBSCRIPTION=gmail_notifications_sub
GOOGLE_APPLICATION_CREDENTIALS=path_to_your_service_account_key.json
```

## Alternative: Polling Approach

If Pub/Sub setup is complex, you can use a simpler polling approach:

```typescript
// Simple polling version
setInterval(async () => {
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: `label:${TARGET_LABEL} is:unread`,
    maxResults: 10,
  });

  for (const message of response.data.messages || []) {
    const emailData = await gmailService.getEmailById(message.id!);
    if (emailData) {
      await executeCustomFunction(emailData);
      // Mark as read to avoid reprocessing
      await gmail.users.messages.modify({
        userId: 'me',
        id: message.id!,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    }
  }
}, 30000); // Poll every 30 seconds
```
