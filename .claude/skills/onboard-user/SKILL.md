---
name: onboard-user
description:
  Onboard a new user or tenant onto Accounter end to end — create the tenant, connect banks and
  cards with the scraper app, ingest, and categorise charges. Use when asked to onboard someone, set
  up a new business, connect a bank or card, or get a fresh tenant's data in, locally or on a
  deployed Accounter.
---

Onboard the user described in: $ARGUMENTS

Read `docs/onboarding/README.md` first. It has the eight steps, the per-bank notes and the known
gaps. This file adds what an agent must do differently from a person.

## Before anything else

1. **Decide the target database and say it out loud.** Local or deployed? If local, never rely on
   the root `.env`: pass `POSTGRES_*` explicitly on every command that touches a database (server,
   migrations, codegen, tests, seeds). Do not read `.env` files and do not add `ALLOW_REMOTE_DB`,
   `ALLOW_DEMO_SEED` or `ALLOW_DEMO_SEED_DATABASE` to any command.
2. **Check which Accounter an MCP connector points at** before using its write tools: call
   `accounter_list_business_memberships` and compare with the tenant you are onboarding. A connector
   set up in the user's Claude client is usually the deployed one.
3. **Ask which email the owner's sign-in shows** (Google reports the Workspace address for an
   aliased Gmail). Create the tenant with that address.

## Credentials

- The owner types their own bank and card credentials into the scraper app. Never type, read, store
  or repeat them, and never ask for them in chat.
- Do not retry a failing provider login. Max locks the user after failed attempts and American
  Express blocks automated logins after a few in a row. After one failure, stop that source, tell
  the user what the page showed, and continue with the others.
- One-time codes are entered by the owner.

## Order of work

Follow the steps in the runbook in order. At each step verify before moving on:

- After creating the tenant: the business exists, the owner's membership exists, and government id
  and registration date are set.
- After creating financial accounts: one per bank account and per card, numbers matching what the
  scraper reports.
- After each scrape: count transactions per account and date range in the database or through
  `accounter_get_transactions`. "Skipped" for every row usually means the rows collide with another
  tenant's or the account is missing, not that they already exist.
- After categorising: every charge has a description and a tag; report how many transactions were
  left without a business and why.

## Categorising with the MCP tools

- Page `accounter_get_charges` with `pageSize: 40` when `includeTransactions` is on. If a result
  carries `continuation.reason: "payload_size"`, rows were dropped from that page; repeat it with a
  smaller page.
- Build the whole plan (group → business, tag, description, type) before writing anything, and show
  the user a summary of it.
- Create each tag and business once. Both tools refuse a name that already exists and return the
  existing id; use it.
- Leave cash withdrawals, cheques and rows you cannot identify without a business rather than
  guessing one.
- Mark card bills on the bank account as `CREDITCARD_BANK`.
- Keep a state file in the scratchpad so an interrupted run resumes instead of repeating writes.

## Reporting

End with: what was connected and the date range each source covers, counts (accounts, transactions,
businesses, tags), what was not done (a locked or blocked provider, sources not yet connected), and
anything in the product that got in the way, so it can be fixed.

This repository is public. Keep names, account numbers, emails and amounts of the person being
onboarded out of commits, branch names, pull requests and docs.
