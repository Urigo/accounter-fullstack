# RLS Enforcement Analysis — `accounter_schema`

Analysis of which tables should have Row Level Security enforced, based on data ownership and access
patterns.

---

## Should NOT enforce RLS (global/shared reference data)

| Table                          | Reason                                         |
| ------------------------------ | ---------------------------------------------- |
| `business_trips_tax_variables` | Global tax rate parameters, same for all users |
| `countries`                    | Static country list, no ownership              |
| `crypto_currencies`            | Shared crypto reference data                   |
| `crypto_exchange_rates`        | Global market data                             |
| `depreciation_categories`      | Shared configuration                           |
| `exchange_rates`               | Global fiat rates                              |
| `migration`                    | System tracking table                          |
| `permissions`                  | Global permission definitions                  |
| `recovery`                     | Shared annual tax recovery rates               |
| `role_permissions`             | Global role-permission mappings                |
| `roles`                        | Global role definitions                        |
| `vat_value`                    | Shared historical VAT rates                    |

---

## Should enforce RLS (per-user/per-business data)

| Table                                  | Ownership Column                  | Notes                                      |
| -------------------------------------- | --------------------------------- | ------------------------------------------ |
| `api_keys`                             | `business_id`                     | Sensitive credentials                      |
| `api_key_permission_overrides`         | via `api_keys.business_id`        | Indirect ownership                         |
| `audit_logs`                           | `business_id` (nullable)          | Null = system events, needs special policy |
| `bank_deposits`                        | `owner_id`                        | Direct ownership                           |
| `invitations`                          | `business_id`                     | Business-scoped invitations                |
| `user_permission_overrides`            | `business_id` + `user_id`         | Per-business permission grants             |
| `business_users`                       | `business_id` / `user_id`         | Users can only see their own memberships   |
| `transactions_raw_list`                | via joined transaction tables     | Indirect, needs join to `transactions`     |
| `poalim_ils_account_transactions`      | via `financial_accounts.owner_id` | Indirect via account_number/bank/branch    |
| `poalim_eur_account_transactions`      | via `financial_accounts.owner_id` | Indirect via account_number/bank/branch    |
| `poalim_gbp_account_transactions`      | via `financial_accounts.owner_id` | Indirect via account_number/bank/branch    |
| `poalim_usd_account_transactions`      | via `financial_accounts.owner_id` | Indirect via account_number/bank/branch    |
| `poalim_cad_account_transactions`      | via `financial_accounts.owner_id` | Indirect via account_number/bank/branch    |
| `poalim_swift_account_transactions`    | via `financial_accounts.owner_id` | Indirect via account_number/bank/branch    |
| `poalim_foreign_account_transactions`  | via `financial_accounts.owner_id` | Indirect via account_number/bank/branch    |
| `poalim_deposits_account_transactions` | via `financial_accounts.owner_id` | Indirect via account_number/bank/branch    |
| `amex_creditcard_transactions`         | via `financial_accounts.owner_id` | Indirect via card                          |
| `cal_creditcard_transactions`          | via `financial_accounts.owner_id` | Indirect via card                          |
| `isracard_creditcard_transactions`     | via `financial_accounts.owner_id` | Indirect via card                          |
| `max_creditcard_transactions`          | via `financial_accounts.owner_id` | Indirect via card                          |
| `bank_discount_transactions`           | via `financial_accounts.owner_id` | Indirect via account_number                |
| `etana_account_transactions`           | via `financial_accounts.owner_id` | Indirect via account_id                    |
| `etherscan_transactions`               | via `financial_accounts.owner_id` | Indirect via wallet_address                |
| `kraken_ledger_records`                | via `financial_accounts.owner_id` | Indirect via account_nickname              |
| `kraken_trades`                        | via `financial_accounts.owner_id` | Indirect via account_nickname              |

---

## Special / Deprecated

| Table   | Notes                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------- |
| `users` | Deprecated — being dropped in current migration branch (`user-accounts-migration-phase-3-7`). Skip. |

---

## Key challenge: indirect ownership

The raw transaction tables (all Poalim, Amex, Cal, Kraken, etc.) don't have a direct `owner_id`
column — they link to `financial_accounts` via account/card identifiers. RLS on these requires one
of:

1. A **security definer view** that joins through `financial_accounts`, or
2. Adding a **denormalized `owner_id` column** to each transaction table, or
3. A **policy with a subquery**, e.g.:
   ```sql
   account_number IN (
     SELECT account_number FROM accounter_schema.financial_accounts
     WHERE owner_id = accounter_schema.current_business_id()
   )
   ```

Option 3 is the most common pattern and avoids schema changes, but may have performance implications
at scale. Option 2 is simpler and faster but requires a migration per table.
