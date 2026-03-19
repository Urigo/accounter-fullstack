# Configuration Classification

Every configuration value falls into one of three groups.
Platform config stays in `.env`. Everything else moves to DB.

## 1. Platform / System Config (stays in .env)

Infrastructure and deployment-level settings. Never customer-facing.

| Variable | Purpose |
|----------|---------|
| `POSTGRES_*` | Database connection and pool |
| `AUTH0_*` | Auth0 tenant and API identifiers |
| `HIVE_TOKEN` | GraphQL Hive observability |
| `FRONTEND_URL` | Server redirect target |
| `SETTINGS_ENCRYPTION_KEY` | AES key for encrypting source credentials |
| `RELEASE`, `DEBUG`, `NODE_ENV`, `PORT` | Runtime flags |

## 2. Workspace / Company Settings (DB: `workspace_settings`)

Per-business configuration that a customer controls via Settings UI.

| Setting | DB column |
|---------|-----------|
| Company display name | `company_name` |
| Company logo URL | `logo_url` |

Tax categories, currencies, locality remain in `user_context` (existing).

## 3. Source Connection Settings (DB: `source_connections`)

Per-business credentials for external data sources. Secrets stored encrypted
server-side, never returned via API.

| Connection type | Provider key |
|-----------------|-------------|
| Bank: Poalim | `hapoalim` |
| Bank: Mizrahi | `mizrahi` |
| Bank: Discount | `discount` |
| Credit: Isracard | `isracard` |
| Credit: Amex | `amex` |
| Credit: CAL | `cal` |
| Credit: MAX | `max` |
| Integration: Cloudinary | `cloudinary` |
| Integration: Green Invoice | `green_invoice` |
| Integration: Google Drive | `google_drive` |
| Integration: Gmail | `gmail` |
| Integration: Deel | `deel` |

## Backward Compatibility

When DB settings are absent, the server falls back to `.env`.

## Security Rules

- `source_connections.credentials_encrypted` is AES-256-GCM encrypted at rest
- `SETTINGS_ENCRYPTION_KEY` is platform-only (never in DB or API)
- GraphQL never returns raw credential values
- Only connection metadata (provider, status, account hint) is exposed
- Credentials can only be set/updated, never read back
