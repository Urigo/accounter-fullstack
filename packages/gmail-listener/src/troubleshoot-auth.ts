import { google } from 'googleapis';
import type { Environment } from './environment.js';

export async function troubleshootOAuth(gmailEnv: Environment['gmail']) {
  console.log('🔍 OAuth2 Configuration Troubleshooter\n');

  // Check environment variables
  const requiredVars: (keyof Environment['gmail'])[] = ['clientId', 'clientSecret', 'refreshToken'];

  console.log('1. Checking environment variables:');
  let missingVars = !gmailEnv;

  requiredVars.map(varName => {
    const value = gmailEnv?.[varName];
    if (value) {
      const display =
        varName.includes('SECRET') || varName.includes('TOKEN')
          ? `${value.substring(0, 10)}...`
          : value;
      console.log(`   ✅ ${varName}: ${display}`);
    } else {
      console.log(`   ❌ ${varName}: Missing`);
      missingVars = true;
    }
  });

  if (missingVars) {
    console.log('\n❌ Missing required environment variables. Please check your .env file.');
    return;
  }

  // Test OAuth2 client setup
  console.log('\n2. Testing OAuth2 client setup:');

  const oauth2Client = new google.auth.OAuth2(gmailEnv!.clientId!, gmailEnv!.clientSecret!);

  // Test refresh token
  console.log('\n3. Testing refresh token:');

  try {
    oauth2Client.setCredentials({
      refresh_token: gmailEnv!.refreshToken!,
    });

    // Force token refresh
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('   ✅ Refresh token is valid');
    console.log(`   📝 New access token: ${credentials.access_token?.substring(0, 20)}...`);

    // Test Gmail API access
    console.log('\n4. Testing Gmail API access:');

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`   ✅ Gmail API access successful`);
    console.log(`   📧 Email: ${profile.data.emailAddress}`);
    console.log(`   💬 Total messages: ${profile.data.messagesTotal}`);

    // Test watch capability (the failing operation)
    console.log('\n5. Testing watch permissions:');

    try {
      // First, stop any existing watch
      try {
        await gmail.users.stop({ userId: 'me' });
        console.log('   📴 Stopped existing watch');
      } catch (e) {
        const errorMessage = (e as Error)?.message;
        console.log(`   ℹ️  No existing watch to stop: ${errorMessage}`);
      }

      // Test topic format (common issue)
      const projectId = gmailEnv?.cloudProjectId || 'your-project-id';
      const topicName = gmailEnv?.topicName || 'gmail-notifications';
      const fullTopicName = `projects/${projectId}/topics/${topicName}`;

      console.log(`   📡 Testing watch with topic: ${fullTopicName}`);

      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: fullTopicName,
          labelIds: ['INBOX'],
        },
      });

      console.log('   ✅ Watch setup successful!');
      console.log(
        `   🕐 Expiration: ${new Date(parseInt(watchResponse.data.expiration!)).toLocaleString()}`,
      );
    } catch (watchError) {
      console.log('   ❌ Watch setup failed:');
      const errorMessage = (watchError as Error)?.message;
      console.log(`      Error: ${errorMessage}`);

      if (errorMessage?.includes('topicName')) {
        console.log('\n💡 Troubleshooting tips for watch errors:');
        console.log('   • Verify Pub/Sub topic exists and is properly formatted');
        console.log('   • Check IAM permissions for the topic');
        console.log('   • Ensure domain verification is complete');
        console.log('   • Try using a simpler polling approach instead');
      }
    }
  } catch (error) {
    console.log('   ❌ Refresh token test failed:');
    const errorMessage = (error as Error)?.message;
    console.log(`      Error: ${errorMessage}`);

    if (errorMessage?.includes('invalid_grant')) {
      console.log('\n💡 invalid_grant error solutions:');
      console.log('   1. Generate a new refresh token (token may have expired)');
      console.log('   2. Ensure OAuth consent screen is published (not in testing)');
      console.log('   3. Check that the user email is added to test users (if in testing)');
      console.log('   4. Verify redirect URI matches exactly in Google Console');
      console.log('   5. Make sure to include "prompt: consent" when generating tokens');
      console.log('\n   Run: npm run generate-token');
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.settings.basic',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Forces consent screen to get refresh token
    });
    console.log('\n💡 To manually generate a new refresh token:');
    console.log(`   📥 Visit this URL: ${authUrl}`);
  }

  console.log('\n🔧 Configuration check complete!');
}
