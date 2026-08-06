import { z } from 'zod';
import type { ToolDefinition, ToolResult } from './registry.js';

/**
 * The data-model guide (feedback §8).
 *
 * The connector feedback singled out one missing thing as costing more than any
 * other: nothing explains how Accounter's accounts and charges actually relate,
 * so an agent reverse-engineers it from Hebrew bank descriptions and gets it
 * subtly wrong. This tool is that explanation.
 *
 * It is a **tool, not an MCP resource**, deliberately. The handler advertises
 * only `capabilities: { tools: { listChanged: false } }` (`mcp/handler.ts`), and
 * implementing the resources protocol to serve one static document is more
 * moving parts than payoff. As a tool it also shows up in `tools/list`, where a
 * model actually looks.
 *
 * The handler is **pure** — no upstream call, no auth beyond being a registered
 * caller — so it is safe to call first, before any business is chosen.
 *
 * Every claim below is checked against the code, not against the feedback's
 * inferences; where the two differ (notably the card-settlement link, which
 * *does* exist upstream) the code wins.
 */

export const DATA_MODEL_GUIDE_TOOL_NAME = 'accounter_data_model_guide';

const dataModelGuideInput = z.object({});
type DataModelGuideInput = z.infer<typeof dataModelGuideInput>;

/**
 * Bumped whenever the guide's content changes materially, so a client that
 * caches it can tell. Not the package version — this tracks the text.
 */
export const DATA_MODEL_GUIDE_VERSION = '1.0.0';

export const DATA_MODEL_GUIDE = `# Accounter data model — read this before interpreting the numbers

## Accounts (\`accounter_list_accounts\`)

Every transaction belongs to an account, and the account's \`type\` determines whether you should
count it. Summing all transaction rows without checking \`type\` gives a wrong answer.

- **\`BANK_ACCOUNT\`** — a real bank account. Its rows are actual cash movements.
- **\`CREDIT_CARD\`** — one row per merchant purchase. **These are not separate cash movements.**
  The bank later debits a single settlement amount covering many card rows, and that settlement is
  its own \`BANK_ACCOUNT\` row. Counting both double-counts every card purchase.
- **\`BANK_DEPOSIT_ACCOUNT\`** — deposits. Money is swept here out of the checking account, so a
  checking account can show a near-zero running total by design while the money simply sits in a
  deposit. Sweeps are transfers, not expenses.
- **\`FOREIGN_SECURITIES\`** — securities activity. These rows are **single-legged**: a buy or sell
  appears here with no mirror row in a bank account. Summing everything therefore gives cash only;
  excluding them gives cost basis. Neither is market value — unrealized gains are not in this data.
- **\`CRYPTO_WALLET\`** — crypto holdings, valued through crypto exchange rates.

## Charges group the legs

A **charge** is the unit of bookkeeping: it groups the transactions and documents that belong to one
economic event. \`chargeType\` (and the derived \`flowKind\`) tells you what kind of event it was —
this is the reliable signal. Do **not** classify by matching Hebrew strings in \`description\`.

| \`chargeType\` | \`flowKind\` | Meaning |
| --- | --- | --- |
| \`COMMON\` | \`income\` / \`expense\` | Ordinary business activity; direction from the amount sign. |
| \`CREDITCARD_BANK\` | \`internal_transfer\` | A bank settlement paying off card purchases. **It groups both legs** — the settlement transaction and the card transactions it covers — so the pairing you need is here. |
| \`BANK_DEPOSIT\` | \`internal_transfer\` | A sweep between checking and a deposit. |
| \`INTERNAL\` | \`internal_transfer\` | A transfer between the business's own accounts. |
| \`CONVERSION\` | \`conversion\` | One currency exchanged for another; two legs, no net change in value. |
| \`FOREIGN_SECURITIES\` | \`investment\` | Securities buy/sell. |
| \`PAYROLL\` | \`payroll\` | Salary payments. |
| \`VAT\` | \`tax\` | A monthly VAT settlement with the tax authority. |
| \`DIVIDEND\` | \`dividend\` | Dividend distribution. |
| \`BUSINESS_TRIP\` | \`expense\` | Travel expenses. |
| \`FINANCIAL\` | \`financial\` | Fees, interest, and similar financial items. |

**\`flowKind: internal_transfer\` is the one to watch.** Those charges move money between accounts
the business already owns. They are neither income nor expense, and including them inflates both.

## Answering "how much did we make?"

Prefer the report tools over deriving numbers from rows — they use the double-entry ledger, which is
authoritative; the raw bank feed is not. \`accounter_profit_and_loss\` (yearly P&L),
\`accounter_income_expense_summary\` (monthly, currency-converted), \`accounter_counterparty_totals\`
(who money came from or went to), \`accounter_vat_report\` (output vs input VAT).

## Balances are not available per transaction

Only some bank feeds report a running balance; card, deposit and SWIFT rows store a placeholder
indistinguishable from a real zero, so the connector does not expose it rather than hand you a wrong
number. So: \`accounter_list_accounts\` returns **no balance field**, and
\`accounter_income_expense_summary\`'s \`cumulativeNet\` is a running sum of that period's own flows
from zero — a **trend, not a balance**, and it counts card rows alongside the bank rows settling
them. Reason about cash position from account \`type\` and flows, and say plainly that exact balances
are unavailable.

## Currency

Transactions carry \`amount\` in origin currency plus \`amountLocal\` and \`exchangeRate\` — the
historical rate for that transaction's own event date. **Use those.** Applying today's rate to years
of history is a common and material error. Both are \`null\` when no rate is on file; that means
"unknown", not "1". Report tools convert server-side and take a \`currency\` argument.

## Documents

\`direction\`: \`issued\` = the business raised the document (revenue), \`received\` = it was billed
(expense). It is \`null\` when the business is neither party — credit invoices, or a missing creditor
— and null means **undetermined**, not "either". \`amountExVat\` is the amount net of VAT.

## Date filters — the subtle one

A charge draws dates from several sources (documents, event dates, debit dates, ledger dates), and
the two filter families ask different questions:

- \`fromDate\` / \`toDate\` — **containment**: the charge's earliest *and* latest dates must fall
  inside the window. A charge straddling the boundary is excluded.
- \`fromAnyDate\` / \`toAnyDate\` — **overlap**: the charge has *some* activity in the window.

\`accounter_search_charges\` uses **overlap**, so its results can legitimately include charges with
older event dates — expected, not a bug. For containment use \`accounter_get_charges\`, which exposes
all four directly. Transactions are simpler: \`fromEventDate\`/\`toEventDate\`,
\`fromDebitDate\`/\`toDebitDate\`, or \`fromAnyDate\`/\`toAnyDate\` for either.

## Reading responses

List responses report \`returnedCount\`, \`totalCount\` and \`truncated\`, and echo the effective
\`scope.businessIds\`. When \`truncated\` is true you are not seeing everything — narrow the filters
rather than assuming the total. Call \`accounter_list_business_memberships\` first to learn which
businesses you can query.
`;

function handler(_input: DataModelGuideInput): ToolResult {
  return {
    content: [{ type: 'text', text: DATA_MODEL_GUIDE }],
    structuredContent: {
      guide: DATA_MODEL_GUIDE,
      version: DATA_MODEL_GUIDE_VERSION,
    },
  };
}

export const dataModelGuideTool: ToolDefinition<typeof dataModelGuideInput> = {
  name: DATA_MODEL_GUIDE_TOOL_NAME,
  description:
    'Explains how Accounter models accounts, charges, documents, currency, and date filters — ' +
    'including the traps that make naive aggregation wrong (credit-card rows are settled again by ' +
    'a bank row, deposit sweeps and internal transfers are not expenses, securities rows have no ' +
    'mirror leg, and per-transaction balances are unavailable). Read this BEFORE summing ' +
    'transactions, computing revenue, or reporting how much money the business has. Takes no ' +
    'parameters and needs no business scope, so it is safe to call first. Read-only.',
  inputSchema: dataModelGuideInput,
  policy: {
    // No scope required: this is documentation, not business data, and gating it
    // would make it unavailable in exactly the cold-start moment it is for.
    requiresBusinessScope: false,
    dataClassification: 'public',
  },
  handler,
};
