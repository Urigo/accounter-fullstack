# MCP Server — Connecting Clients

How MCP hosts connect to the production Accounter MCP server, `https://mcp.accounter.tax/mcp`, and
how the Auth0 tenant is configured for each one.

Two clients are supported and verified: **Claude** (claude.ai / Claude Desktop) and **Cursor**.
Others are not configured yet — see
[Adding another static-client MCP host](#adding-another-static-client-mcp-host).

For running the server locally see [`local-development.md`](./local-development.md); for incidents
see [`operations-runbook.md`](./operations-runbook.md).

## How it works

The MCP server is only an OAuth protected resource. Auth0 is the authorization server, and the
server checks a token's issuer, audience and signature, not which client requested it. So connecting
a client is entirely Auth0 configuration.

**Policy: one pre-registered Auth0 application per MCP client family.** Each one is:

- a **Native**, public client: Authorization Code with PKCE, no client secret
  (`token_endpoint_auth_method: none`), so its client ID can be published;
- limited to the **Authorization Code** and **Refresh Token** grants;
- given **exact** callback URLs — Auth0 does not accept wildcards or "any port" loopback redirects;
- authorized for user access on the Accounter API (`https://api.accounter.com`) through its own
  client grant.

Every token, whichever client requests it, has the audience `https://api.accounter.com`. Auth0
ignores the RFC 8707 `resource` parameter MCP clients send and uses the tenant Default Audience,
which is that same API (gap 3 in
[`connector-gaps-and-decisions.md`](./connector-gaps-and-decisions.md)).

## Claude (claude.ai / Claude Desktop)

**Settings → Connectors → Add custom connector**

| Field                 | Value                              |
| --------------------- | ---------------------------------- |
| Name                  | `Accounter`                        |
| Remote MCP server URL | `https://mcp.accounter.tax/mcp`    |
| OAuth Client ID       | `YHHwkpmelOQBnQw4WLctlIBcBsWrcuis` |
| OAuth Client Secret   | leave empty                        |

Connect, complete the Auth0 sign-in in the browser, then ask Claude to list your businesses.

## Cursor

1. In Cursor, remove any older Accounter entry first.
2. Add this to `~/.cursor/mcp.json`:

   ```json
   {
     "mcpServers": {
       "accounter": {
         "url": "https://mcp.accounter.tax/mcp",
         "auth": {
           "CLIENT_ID": "gcOHgI2VxNcwLPmmBZwIG93GKHTLw5G5",
           "scopes": ["openid", "profile", "email", "offline_access"]
         }
       }
     }
   }
   ```

   There is no client secret. `offline_access` is what gets Cursor a refresh token.

3. Connect and sign in. Expect a one-time consent screen: Auth0 always asks for consent when the
   callback is on `localhost`.
4. Cursor should list the `accounter_*` tools.

## Checking a connection

- **Auth0 Logs** (Dashboard → Monitoring → Logs), filtered by the app's client ID: a sign-in shows
  `s` then `seacft` (code exchanged for a token); later refreshes show `sertft`.
- **`GET /metrics`** on the MCP server: entries under `requestsTotal`, and nothing new under
  `authFailuresTotal`.

## Troubleshooting

| Symptom                                                    | Cause                                                                                                                                       | Fix                                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Auth0 error page, "Callback URL mismatch"                  | The client sent a `redirect_uri` that is not in the app's Allowed Callback URLs. Matching is exact: scheme, host, port, path, trailing `/`. | Open the `f` event in Auth0 Logs; it shows the exact `redirect_uri`. Add that URI to the right app (operators only).      |
| Sign-in succeeds, then "not authorized"                    | The client connected **without a client ID** and registered itself through Dynamic Client Registration (see below).                         | Configure the client ID from this guide.                                                                                  |
| Sign-in succeeds, then "not authorized", client ID was set | The app has no user-access grant on the Accounter API.                                                                                      | Operators: check the app under Applications → APIs → Accounter API → Application Access.                                  |
| `feacft` in Auth0 Logs                                     | The code exchange failed, usually because the client sent a secret (or the app expects one). These apps take none.                          | Remove the client secret from the client; check the app's authentication method is None.                                  |
| Works, then asks to reconnect                              | Refresh tokens expire after 30 days, or 15 days without use.                                                                                | Expected — reconnect. Anything sooner: see playbook E in [`operations-runbook.md`](./operations-runbook.md).              |
| Connection or tool calls fail with `401`                   | Token rejected by the MCP server.                                                                                                           | Playbook A in [`operations-runbook.md`](./operations-runbook.md).                                                         |
| Signed in, but no businesses                               | The user's Auth0 `sub` is not mapped in `business_users.auth0_user_id`.                                                                     | See the identity model in [`docs/operations/auth0-runbook.md`](../../../docs/operations/auth0-runbook.md#identity-model). |

### Dynamic Client Registration (current behaviour)

Dynamic Client Registration (DCR) is enabled on the tenant. A client that connects without a client
ID can register itself, but the result is a **third-party** client, and the Accounter API only
accepts apps authorized one by one. Such a client signs in successfully and then fails with "not
authorized". That is expected under the current tenant settings. Whether to keep DCR, and whether
self-registered clients should get API access, is open in #4616.

## Tenant configuration record

There is no Auth0 config-as-code, so this is the record. Production tenant, as of 2026-10-18.

| Setting               | Claude — "Accounter MCP server"                                     | Cursor — "Cursor MCP connector"                                                                                                                            |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client ID             | `YHHwkpmelOQBnQw4WLctlIBcBsWrcuis`                                  | `gcOHgI2VxNcwLPmmBZwIG93GKHTLw5G5`                                                                                                                         |
| Type                  | Native, first-party, public client                                  | Native, first-party, public client                                                                                                                         |
| Token auth method     | None (PKCE, no secret)                                              | None (PKCE, no secret)                                                                                                                                     |
| Allowed callback URLs | `https://claude.ai/api/mcp/auth_callback`                           | `http://localhost:8787/callback`, `http://127.0.0.1:8787/callback`, `http://127.0.0.1:5602/oauth/callback`, `cursor://anysphere.cursor-mcp/oauth/callback` |
| Grant types           | `authorization_code`, `refresh_token` (implicit removed 2026-10-18) | `authorization_code`, `refresh_token`                                                                                                                      |
| Connections           | `Username-Password-Authentication`, `google-oauth2`                 | `Username-Password-Authentication`, `google-oauth2`                                                                                                        |
| Refresh tokens        | Rotating (30 s overlap); expire after 30 days, or 15 days idle      | Rotating (30 s overlap); expire after 30 days, or 15 days idle                                                                                             |
| Client grant          | `https://api.accounter.com`, `subject_type: user`, `scope: []`      | `https://api.accounter.com`, `subject_type: user`, `scope: []`                                                                                             |

Rotation and expiration were turned on for both apps on 2026-10-18 and verified across two refreshes
on each.

Related tenant settings: the Default Audience is `https://api.accounter.com`; the Accounter API's
access policy is per-app authorization; DCR is on (see above). The API's auto-created test
application (`jTQFYG0Jgzoj5HlQzB2YNiRbfiB8dYJh`), which earlier docs named as the Claude connector,
no longer exists.

## Adding another static-client MCP host

For operators. It is the production tenant: record each value before you change it, and update the
record above afterwards.

1. **Find the exact redirect URI.** Have the client try to connect with an existing connector app's
   client ID. The attempt fails with "Callback URL mismatch", and the `f` event in Auth0 Logs shows
   the `redirect_uri` it sent. The client must use a fixed one; a random port per session cannot be
   allowed.
2. **Create the app.** Applications → Create Application → **Native**. Name it after the client
   family, for example "&lt;Client&gt; MCP connector".
3. **Settings → Allowed Callback URLs:** the exact URI(s) from step 1.
4. **Advanced Settings → Grant Types:** Authorization Code and Refresh Token only.
5. **Credentials → Authentication Method:** None.
6. **Connections:** `Username-Password-Authentication` and `google-oauth2` only.
7. **Refresh Token Rotation and Expiration:** rotation on with a 30-second overlap; absolute
   expiration 30 days; inactivity expiration 15 days.
8. **API access:** Applications → APIs → Accounter API → Application Access → authorize the new app
   for user access, with no scopes. Leave client access off. Don't change the API's access policy;
   it must stay per-app authorization.
9. **Verify** with a real client: sign in, see `s` then `seacft` for the new client ID, list the
   tools. Then add a section to this guide.

Leave the existing apps alone: don't add another client's callbacks to them, and don't change
tenant-wide settings (Default Audience, DCR, default client grants).

### Not yet configured

These clients have no Auth0 app yet. What we know so far is **unverified against our tenant**;
confirm the exact `redirect_uri` from the Auth0 `f` log on the first attempt.

- **Claude Code** supports a pre-registered public client:
  `claude mcp add --transport http --client-id <id> --callback-port <port> …`. The redirect is
  `http://localhost:<port>/callback`. The port must be pinned with `--callback-port`, because the
  default is random.
- **VS Code** prompts for a client ID when a server doesn't support self-registration. Redirects:
  `http://127.0.0.1:33418/` (with the trailing slash) and `https://vscode.dev/redirect`.
