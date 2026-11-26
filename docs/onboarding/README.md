# Onboarding a new user

How to take someone from "I have a bank account" to "my charges are in Accounter, categorised", and
what goes wrong on the way. Written after doing it once end to end for a new tenant with a bank
account and four credit cards. It applies to both ways of running Accounter:

- **Cloud**: the tenant lives in a deployed Accounter; an operator (super-admin) creates it.
- **Local**: the user, or their own coding agent, runs everything from this repository against a
  local database.

The steps are the same; only who performs them and where the database is differ.

## The path

| #   | Step                               | Who             | Where it lives                                                                     |
| --- | ---------------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| 1   | Create the tenant                  | Super-admin     | `bootstrapNewClient` — [super-admin runbook](../super-user/super-admin-runbook.md) |
| 2   | Invite the owner and sign in       | Operator, owner | Invitation link, Auth0 Universal Login                                             |
| 3   | Fill in the business details       | Owner           | Client: business settings                                                          |
| 4   | Create the financial accounts      | Owner           | Client: financial accounts                                                         |
| 5   | Create a scraper API key           | Owner           | `generateApiKey(name, roleId: "scraper")`                                          |
| 6   | Connect banks and cards            | Owner           | [`@accounter/scraper-app`](../../packages/scraper-app/README.md)                   |
| 7   | Run the scrape                     | Owner           | Scraper app, **Run** tab                                                           |
| 8   | Set businesses, descriptions, tags | Owner or agent  | Client, or the [MCP server](../../packages/mcp-server/README.md) write tools       |

### 1. Create the tenant

There is no screen for this yet. A super-admin calls `bootstrapNewClient` (see the runbook for the
mutation and what it creates). Things to know:

- The business id is derived from `businessName`. Two tenants cannot share a name, and renaming
  later does not change the id.
- The mutation creates a blocked Auth0 user for `ownerEmail` inside the same database transaction.
  If the transaction rolls back afterwards, the Auth0 user stays.
- The super-admin who runs it becomes an owner of the new tenant alongside the invited owner. Check
  the memberships afterwards and remove what should not stay.

### 2. Invite the owner

`bootstrapNewClient` returns an `invitationToken`. Nothing sends it: build the acceptance link and
send it yourself.

- **Use the address the owner actually signs in with.** If they use "Sign in with Google" and their
  Gmail address is an alias of a Google Workspace account, Google reports the Workspace address. The
  invitation is then for a different email and acceptance fails with "Invalid invitation token". Ask
  which address their Google account shows before creating the tenant.
- A user who signs in before accepting sees "Verify your email". No email was sent; they need the
  invitation link.

### 3. Business details

A new tenant has no government id and no registration date. Reports and some screens need them; set
them in the business settings before going further.

### 4. Financial accounts

Create one financial account per bank account and per card, with the number the scraper reports (the
card's last four digits for cards). Transactions for an account that does not exist are rejected or
skipped, depending on the source. A bank account needs both a bank number and a branch number.

### 5. Scraper API key

Uploads from the scraper app are authenticated with an API key that has the `scraper` role, created
with `generateApiKey`. The key is shown once.

### 6. Connect banks and cards

Follow the scraper app README. The owner types their own credentials into the app; nobody else
should, and an agent must not. Per source:

| Source                      | Notes                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bank Leumi                  | Login runs in a real browser (the bank's login cannot be done over plain HTTP); data is then read from the bank's JSON endpoints.                     |
| CAL                         | Card digits are optional: leave them empty to fetch every card of the login.                                                                          |
| American Express / Isracard | Blocks automated logins after a few attempts in a row. Run it once, and wait some hours before retrying after a failure.                              |
| Max                         | May ask for an ID number on top of the password, and **locks the user after failed attempts**. Do not retry a failing Max login; fix the cause first. |

### 7. Run the scrape

Start with a short range to confirm each source uploads, then run the full history. New accounts
found by a scrape have to be approved in the app before their transactions upload.

### 8. Categorise

After ingestion every transaction has a charge, and none has a business, a description or a tag.
This is the largest part of the work. It can be done in the client, or by an agent through the MCP
server's write tools (`MCP_ENABLE_WRITE_TOOLS=1`):

1. `accounter_get_charges` with `includeTransactions`, page by page. Keep the page small (40 works
   with transactions included): a page that does not fit the response is cut, and the rows cut are
   not on the next page.
2. Group transactions by merchant text and decide a business, a tag and a description per group.
3. `accounter_create_tag` for the tags, `accounter_create_business` for each business.
4. `accounter_update_transactions` (up to 50 ids per call) to set the counterparty and `isFee`.
5. `accounter_update_charge` for each charge's description and type, and
   `accounter_update_charges_tags` (up to 50 charges per call) for tags.

Card bills on the bank account are `CREDITCARD_BANK` charges; the purchases behind them arrive from
the card itself. Count one or the other when totalling spending, not both.

## Running it locally

The root `.env` may point at any database, including a deployed one, and most commands read it. For
a local onboarding, give every command its target explicitly rather than trusting `.env`. See
[Database safety](../../README.md#database-safety).

```bash
docker compose -f docker/docker-compose.dev.yml up -d db
```

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=accounter POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres POSTGRES_SSL=0 yarn setup
```

Run the server and the scraper app with the same variables. To work without Auth0, the server
accepts `X-Dev-Auth: <user id>` when it is started with `ALLOW_DEV_AUTH=1`, and the client sends it
when built with `VITE_DEV_AUTH_USER_ID`. This is for a local database only.

The MCP server's tools can be run against that local server: point `GRAPHQL_UPSTREAM_URL` at
`http://localhost:4000/graphql`. A connector that is already configured in your Claude client most
likely points at the deployed Accounter, so check which businesses it lists before writing through
it.

## Known gaps

These made the first onboarding slow. Each is a candidate for its own change.

**For the user**

- No screen to create a tenant, and the invitation is not sent.
- Invitation errors do not say what is wrong (wrong email, not yet accepted).
- The financial account form asks for fields that only make sense for one bank.
- Nothing is categorised after the first scrape; there is no automatic first pass.
- A card provider that locks the account gives no warning before the attempt that locks it.

**For the developer**

- No single command creates a local tenant ready to receive a scrape.
- Scraper output and server upload inputs are separate schemas kept in step by hand; a mismatch
  shows up only at upload time.
- Raw-table unique keys that do not include the owner make a second tenant's identical rows look
  like duplicates. New tables must include `owner_id` in their conflict key.
- Instalment purchases can arrive as a purchase, a reversal and the instalments; totals have to net
  refunds.

**For an agent**

- No bulk way to set charge descriptions: one call per charge.
- No tool that suggests a business or tag for a transaction; the agent has to classify from the
  merchant text.
- The MCP server has no documented local mode; running its tools against a local server takes a
  hand-built harness.
