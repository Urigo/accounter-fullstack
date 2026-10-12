# MCP Server — Connecting MCP Clients

How MCP hosts other than Claude get an OAuth client for the Accounter MCP server, and how to connect
them. Part of [#4613](https://github.com/Urigo/accounter-fullstack/issues/4613) (epic
[#4611](https://github.com/Urigo/accounter-fullstack/issues/4611)).

Today this covers **Cursor**. Claude (claude.ai / Claude Desktop) is set up as described in
[`local-development.md`](./local-development.md) §4–5. Claude Code, VS Code and other hosts are not
covered yet (see [Other clients](#other-clients)).

## How a client authenticates

The MCP server is only an OAuth **protected resource**. Auth0 is the authorization server.

1. The client calls `POST https://mcp.accounter.tax/mcp` and gets a `401` whose `WWW-Authenticate`
   header points at `/.well-known/oauth-protected-resource`.
2. That document names the Auth0 tenant as the authorization server (see
   [README → OAuth discovery](../README.md#oauth-discovery)).
3. The client runs Authorization Code + PKCE against Auth0 with its **own client ID**, and Auth0
   redirects back to the client's **redirect URI**.
4. The access token's audience is `https://api.accounter.com`, the tenant's Default Audience, so
   clients that don't send an `audience` still get a token the server accepts. The MCP server and
   the GraphQL API accept the same tokens.

The server does not care which Auth0 application issued the token: it checks issuer, audience and
signature only (`src/auth/token.ts`). Everything that decides whether a given client can log in
lives in the Auth0 tenant, and there is no Auth0 config-as-code. Hence this document.

## Policy: one Auth0 application per client family

Each MCP client family (Claude, Cursor, …) gets its **own** pre-registered Auth0 application:

- **Regular Web Application**.
- Grant types **Authorization Code** and **Refresh Token** only. The Accounter API's access tokens
  live 900s; without refresh, the client drops every 15 minutes.
- **Exact** callback URLs. Auth0 does not accept wildcard ports in Allowed Callback URLs (RFC 8252
  §7.3 is not implemented), so "any loopback port" is not possible.
- The same explicit **user-access** client grant (`subject_type: "user"`) on the Accounter API as
  the Claude connector app.
- Its own client secret. No secret is shared across families, so each can be rotated on its own, and
  the tenant logs tell the clients apart.

This works for any host whose redirect URI is **fixed**: one exact entry then covers every user of
that host. It is a per-family app, not a per-user one. Hosts that pick an ephemeral port, or that
can only use dynamic client registration (DCR), need
[#4616](https://github.com/Urigo/accounter-fullstack/issues/4616) instead.

Adding Cursor's callback to the Claude app also works, but only as a stopgap: it shares one secret
between two clients and makes their log entries indistinguishable.

### Redirect URIs by client

| Client                          | Redirect URI(s)                                | Client type                   |
| ------------------------------- | ---------------------------------------------- | ----------------------------- |
| claude.ai / Claude Desktop      | `https://claude.ai/api/mcp/auth_callback`      | static (pre-registered)       |
| Cursor (current builds)         | `http://localhost:8787/callback`               | static, via `mcp.json` `auth` |
| Cursor (older builds, DCR path) | `cursor://anysphere.cursor-mcp/oauth/callback` | static, via `mcp.json` `auth` |

Client builds change their redirect URI from time to time. The Auth0 log is the source of truth: a
failed login of type `f`, "Callback URL mismatch", shows the exact `redirect_uri` the client sent
(see [Troubleshooting](#troubleshooting)).

## Cursor

### Operator: create the Cursor application (once per tenant)

Done in the Auth0 dashboard by a tenant admin, or through the Management API. For the API, take a
token from _Applications → APIs → Auth0 Management API → API Explorer_ and use
`export TOKEN=… DOMAIN=…`. Before each change, record the current value so it can be rolled back.

1. **Read the Claude connector app's settings.** The Cursor app copies them. Note its application
   type, grant types (_Advanced Settings → Grant Types_), enabled connections, token endpoint
   authentication method, and refresh-token rotation/expiration. Then read its Accounter API grant:

   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
     "https://$DOMAIN/api/v2/client-grants?client_id=<CLAUDE_APP_ID>&audience=https://api.accounter.com"
   ```

   Record `scope` and `subject_type`. Expect `subject_type: "user"`.

   > Gap 7 in [`connector-gaps-and-decisions.md`](./connector-gaps-and-decisions.md) names the API's
   > auto-created test application as the connector client. Confirm which application the live
   > Claude connector actually uses before copying from it.

2. **Confirm the redirect URI.** If a Cursor user has already tried and failed, read the exact
   `redirect_uri` from their `f` "Callback URL mismatch" log entry (scheme, `localhost` vs
   `127.0.0.1`, port, path). Otherwise use the URIs in the [table above](#redirect-uris-by-client).

3. **Create the application.** _Applications → Create Application → **Regular Web Application**_,
   named **"Cursor MCP connector"**. Then:
   - **Allowed Callback URLs:** `http://localhost:8787/callback` (or the exact URI from step 2) and
     `cursor://anysphere.cursor-mcp/oauth/callback`, so older builds work too.
   - **Allowed Logout URLs / Allowed Web Origins:** empty.
   - **Advanced Settings → Grant Types:** Authorization Code and Refresh Token only.
   - **Credentials → Authentication Method:** the same as the Claude app.
   - **Refresh Token Rotation / Expiration:** the same as the Claude app.
   - **Connections:** the same as the Claude app. At least `google-oauth2` and
     `Username-Password-Authentication`.

4. **Grant it user access to the Accounter API**, with the same scopes as the Claude app's grant.
   Dashboard: _APIs → Accounter API → Application Access_ → authorize the new app for **user
   access**. API:

   ```bash
   curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     "https://$DOMAIN/api/v2/client-grants" \
     -d '{"client_id":"<CURSOR_APP_ID>","audience":"https://api.accounter.com","scope":[<same scopes>],"subject_type":"user"}'
   ```

   Also check that _APIs → Accounter API → Settings → Allow Offline Access_ is on; refresh tokens
   need it. It already is if the Claude connector refreshes. Read it, don't change it.

5. **Record the result** in [Tenant configuration record](#tenant-configuration-record).

Out of scope here, and not to be changed as part of this setup: the tenant Default Audience, the DCR
toggle, default client grants for third-party clients, and the server's M2M application.

### Hand the credentials to the user

The client ID and secret identify the Cursor family, not a user; every Cursor user gets the same
pair. Still, the secret is a credential. Send it through a one-time-secret link or a password
manager share, never in plain email or chat.

### User: configure Cursor

Put the credentials in environment variables visible to Cursor:

```bash
export ACCOUNTER_MCP_CLIENT_ID=<client id>
export ACCOUNTER_MCP_CLIENT_SECRET=<client secret>
```

Then add the server to `~/.cursor/mcp.json` (all projects) or the project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "accounter": {
      "url": "https://mcp.accounter.tax/mcp",
      "auth": {
        "CLIENT_ID": "${env:ACCOUNTER_MCP_CLIENT_ID}",
        "CLIENT_SECRET": "${env:ACCOUNTER_MCP_CLIENT_SECRET}",
        "scopes": ["openid", "profile", "email", "offline_access"]
      }
    }
  }
}
```

- The URL ends in `/mcp`. `/` and `/mcp/` both return `404`.
- `offline_access` is what gets a refresh token. Without it, Cursor has to log in again every 15
  minutes.
- Without the `auth` block, Cursor falls back to DCR, which does not work against this tenant (see
  [`connector-gaps-and-decisions.md`](./connector-gaps-and-decisions.md) gap 1).

Restart Cursor (or toggle the server in _Settings → MCP_), click **Login**, and complete the Auth0
sign-in in the browser.

### Verify

- **Auth0 logs** (_Monitoring → Logs_): an `s` (successful login) and then a `seacft` (code
  exchanged for tokens) event for the Cursor app's client ID.
- **Cursor:** the server shows as connected and lists the `accounter_*` tools.
- **A read tool works:** ask for `accounter_list_business_memberships`. It returns one row per
  business you belong to.
- **Server side:** `GET /metrics` shows the call under `requestsTotal`, and nothing new under
  `authFailuresTotal`.

## Tenant configuration record

There is no Auth0 config-as-code, so record each connector app's configuration here whenever it is
created or changed. Client IDs and secrets stay in the tenant and the team's password manager.

| Setting                       | Claude connector app                      | Cursor MCP connector                                                             |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Application type              | _to record_                               | Regular Web Application                                                          |
| Allowed Callback URLs         | `https://claude.ai/api/mcp/auth_callback` | `http://localhost:8787/callback`, `cursor://anysphere.cursor-mcp/oauth/callback` |
| Grant types                   | _to record_                               | Authorization Code, Refresh Token                                                |
| Connections                   | _to record_                               | same as Claude                                                                   |
| Token endpoint auth method    | _to record_                               | same as Claude                                                                   |
| Refresh token rotation/expiry | _to record_                               | same as Claude                                                                   |
| Accounter API client grant    | _to record_ (`subject_type: "user"`)      | same scopes as Claude, `subject_type: "user"`                                    |

## Other clients

Not covered yet; tracked in [#4613](https://github.com/Urigo/accounter-fullstack/issues/4613):

- **Claude Code** (`claude mcp add --transport http …`).
- **VS Code.**

For each, the open questions are the redirect URI it sends, and whether it can use a static client
(then it gets its own application under the policy above) or needs DCR
([#4616](https://github.com/Urigo/accounter-fullstack/issues/4616)).

## Troubleshooting

Most failures happen before the request reaches the MCP server, so read the **Auth0 tenant logs**
(_Monitoring → Logs_, filter by type) first.

| Log type | Meaning                                                           |
| -------- | ----------------------------------------------------------------- |
| `f`      | Failed login, including "Callback URL mismatch"                   |
| `s`      | Successful login                                                  |
| `seacft` | Authorization code exchanged for tokens                           |
| `feacft` | Code exchange failed                                              |
| `sapi`   | Management API operation, including "Dynamic client registration" |

| Symptom                                                                    | Likely cause and fix                                                                                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `f` "Callback URL mismatch"                                                | The redirect URI differs from the allowed ones: `127.0.0.1` vs `localhost`, a trailing slash, the port or the path. Copy `redirect_uri` from the log entry and add it exactly. |
| `feacft` "Unauthorized"                                                    | Wrong client secret, or a token endpoint auth method mismatch. Check the secret, then try the other of _Post_ and _Basic_.                                                     |
| `f` "Client is not authorized to access resource server" / `access_denied` | The user-access client grant on the Accounter API is missing or has the wrong audience. Redo step 4.                                                                           |
| Consent screen loops or is denied                                          | Compare the app's first-party and consent settings with the Claude app's. Third-party apps always require consent.                                                             |
| A new `sapi` "Dynamic client registration" entry from Cursor               | Cursor tried DCR instead of the static client: the `auth` block is missing or not picked up, or Cursor is outdated. Fix the config; delete the stray client.                   |
| Cursor reaches the server but gets `401`                                   | A token or audience problem, not a callback one. See [`operations-runbook.md`](./operations-runbook.md) playbook A.                                                            |
| Cursor asks to log in again every 15 minutes                               | No refresh token: `offline_access` missing from `scopes`, the Refresh Token grant is off, or the API's _Allow Offline Access_ is off.                                          |

## Rollback

Delete the "Cursor MCP connector" application. Its client grant is removed with it. If the stopgap
was used instead, remove the Cursor callback URLs from the Claude app.
