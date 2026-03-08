# Auth0 Operations Runbook

## Common Tasks

### Invite New User

1.  Admin creates invitation via GraphQL mutation
2.  System calls Auth0 Management API to create blocked user
3.  Invitation email sent with magic link
4.  User clicks link, sets password, account unblocked
5.  User can now log in via Auth0 Universal Login

### Reset User Password

Users can self-serve password resets via Auth0 Universal Login:

- Click "Forgot Password" on login page
- Auth0 sends password reset email
- User sets new password

### Revoke User Access

1.  Admin removes user from business via GraphQL mutation
2.  User record marked as inactive in local database
3.  RLS policies prevent data access
4.  Optional: Block user in Auth0 to prevent login

### Troubleshooting

#### User Cannot Log In

- Check Auth0 dashboard: User → View → Blocked status
- Check local database: business_users table, auth0_user_id mapping
- Check Auth0 logs: Dashboard → Monitoring → Logs
- Verify email verified in Auth0

#### JWT Verification Failing

- Check server logs for specific error
- Verify AUTH0_DOMAIN and AUTH0_AUDIENCE config
- Test JWKS endpoint: `curl https://{domain}/.well-known/jwks.json`
- Decode JWT at jwt.io and verify claims

#### Performance Issues

- Check Auth0 status: https://status.auth0.com
- Monitor JWT verification latency (should be < 50ms)
- Check JWKS caching (should cache for 10+ minutes)
- Verify database connection pool not exhausted
