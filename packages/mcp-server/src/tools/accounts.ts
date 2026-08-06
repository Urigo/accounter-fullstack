import { z } from 'zod';
import type { McpListAccountsQuery, McpListAccountsQueryVariables } from '../gql/index.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import {
  assertAuthorizedBusiness,
  businessIdInput,
  SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
} from './scope-input.js';

/**
 * The account directory for one business.
 *
 * This is the answer to "how much money do I have" that the connector was
 * missing — not because it reports balances (it deliberately does not; see
 * below) but because `type` is what makes a transaction feed interpretable at
 * all. Without it, summing every row double-counts credit cards against their
 * bank settlement rows, loses deposit sweeps, and mixes securities cost basis
 * into cash. Knowing which account a row belongs to, and what kind of account
 * that is, resolves all three.
 *
 * **No balances, on purpose.** The obvious implementation — read the newest
 * `Transaction.balance` per account — would be wrong for most accounts:
 * upstream stores a hardcoded `0` for credit-card, deposit and SWIFT rows and
 * the field is non-null, so a placeholder is indistinguishable from a real zero.
 * Reporting `0` for every card would be worse than reporting nothing. Revisit
 * once the column distinguishes "no balance reported" from zero.
 */

export const LIST_ACCOUNTS_TOOL_NAME = 'accounter_list_accounts';

const listAccountsInput = z.object({ businessId: businessIdInput });

type ListAccountsInput = z.infer<typeof listAccountsInput>;

const LIST_ACCOUNTS_QUERY = /* GraphQL */ `
  query McpListAccounts($ownerId: UUID!) {
    financialAccountsByOwner(ownerId: $ownerId) {
      __typename
      id
      name
      number
      type
      privateOrBusiness
      accountTaxCategories {
        currency
      }
      ... on BankFinancialAccount {
        bankNumber
        branchNumber
        iban
        swiftCode
      }
      ... on CardFinancialAccount {
        fourDigits
      }
    }
  }
`;

type RawAccount = McpListAccountsQuery['financialAccountsByOwner'][number];

export interface NormalizedAccount {
  id: string;
  name: string | null;
  number: string | null;
  /** BANK_ACCOUNT | BANK_DEPOSIT_ACCOUNT | CREDIT_CARD | CRYPTO_WALLET | FOREIGN_SECURITIES */
  type: string | null;
  privateOrBusiness: string | null;
  /** Currencies the account is configured for, derived from its tax categories. */
  currencies: string[];
  /** Bank-only identifiers; null on other account kinds. */
  bank: { bankNumber: number | null; branchNumber: number | null; iban: string | null } | null;
  /** Card-only identifier; null on other account kinds. */
  cardLastFour: string | null;
}

function normalizeAccount(account: RawAccount): NormalizedAccount {
  const bank =
    account.__typename === 'BankFinancialAccount'
      ? {
          bankNumber: account.bankNumber ?? null,
          branchNumber: account.branchNumber ?? null,
          iban: account.iban ?? null,
        }
      : null;
  return {
    id: account.id,
    name: account.name ?? null,
    number: account.number ?? null,
    type: account.type ?? null,
    privateOrBusiness: account.privateOrBusiness ?? null,
    // De-duplicated: an account can carry several tax categories per currency,
    // and the currency list is the useful part, not the mapping.
    currencies: [
      ...new Set((account.accountTaxCategories ?? []).map(category => category.currency)),
    ].sort(),
    bank,
    cardLastFour: account.__typename === 'CardFinancialAccount' ? account.fourDigits : null,
  };
}

async function handler(
  input: ListAccountsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const ownerId = assertAuthorizedBusiness(input.businessId, context);

  const variables: McpListAccountsQueryVariables = { ownerId };
  const data = await context.client.query<McpListAccountsQuery>(
    { query: LIST_ACCOUNTS_QUERY, variables },
    context.upstream,
  );

  const accounts = (data.financialAccountsByOwner ?? []).map(normalizeAccount);
  const byType = accounts.reduce<Record<string, number>>((counts, account) => {
    const key = account.type ?? 'UNKNOWN';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return shapeListResult({
    items: accounts,
    itemsKey: 'accounts',
    total: accounts.length,
    extra: {
      businessId: ownerId,
      countsByType: byType,
      scope: { businessIds: context.readScope.businessIds },
    },
    summarize: (shown, total) =>
      total === 0
        ? 'This business has no financial accounts on file.'
        : `${total} account(s)${shown < total ? ` (showing ${shown})` : ''}: ${Object.entries(
            byType,
          )
            .map(([type, count]) => `${count} ${type}`)
            .join(', ')}.`,
  });
}

export const listAccountsTool: ToolDefinition<typeof listAccountsInput> = {
  name: LIST_ACCOUNTS_TOOL_NAME,
  description:
    'List one business’s financial accounts: id, name, number, `type` (BANK_ACCOUNT, ' +
    'BANK_DEPOSIT_ACCOUNT, CREDIT_CARD, CRYPTO_WALLET, FOREIGN_SECURITIES), currencies, and ' +
    'bank/card identifiers. Call this before interpreting transaction data: CREDIT_CARD accounts ' +
    'carry merchant-level rows that are settled again by a matching bank row, so summing both ' +
    'double-counts; BANK_DEPOSIT_ACCOUNT holds sweeps out of the checking account; and ' +
    'FOREIGN_SECURITIES rows have no mirror leg in any bank account. Balances are not available — ' +
    'most sources do not report them. Read-only. ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: listAccountsInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler,
};
