import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type { McpUpdateTransactionsMutation } from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { shapeWriteResult, writeResultDescription } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

/**
 * Write tool: set the counterparty, charge or fee flag on bank/card rows.
 *
 * This is where a charge's counterparty actually gets set. Upstream computes a
 * charge's `counterparty` from the businesses on its transactions (and the
 * creditor/debtor on its documents), so "this card row is Vercel" is a
 * transaction edit, not a charge edit. The same call also moves a transaction
 * between charges, which is the other half of matching: a bank row that landed
 * in its own charge is moved onto the charge holding the invoice it pays.
 *
 * Two upstream behaviours shape the move (`updateTransactions`):
 *  - any move deletes the former charges it left with no transactions,
 *    documents or misc expenses, and reports them as `deletedChargeIds`;
 *  - EMPTY_UUID "unlinks": upstream creates ONE new charge and moves every
 *    listed transaction into it (not one charge per row).
 */

export const UPDATE_TRANSACTIONS_TOOL_NAME = 'accounter_update_transactions';

/** Max transactions edited in one call, matching the other write tools' cap. */
export const MAX_TRANSACTIONS_PER_CALL = 50;

/** Upstream's sentinel for "unlink into a new charge". */
export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

const updateTransactionsInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  transactionIds: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_TRANSACTIONS_PER_CALL)
    .describe(
      `The transactions to edit (1-${MAX_TRANSACTIONS_PER_CALL} per call). Every listed ` +
        'transaction gets the same changes. Use accounter_get_charges (includeTransactions) or ' +
        'accounter_get_transactions to find ids.',
    ),
  counterpartyId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Business to set as the counterparty. Resolve the id with accounter_list_businesses, or ' +
        'create one with accounter_create_business. The charge’s counterparty follows from this.',
    ),
  chargeId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Move the transactions onto this charge (the one holding the matching invoice, say). ' +
        'Upstream deletes a former charge the move leaves empty and reports it under ' +
        `\`deletedChargeIds\`. Pass the all-zero UUID (${EMPTY_UUID}) to unlink: upstream then ` +
        'creates ONE new charge and moves all the listed transactions into it together, so unlink ' +
        'unrelated rows in separate calls.',
    ),
  isFee: z
    .boolean()
    .optional()
    .describe('Mark the transactions as bank/processing fees (true) or not (false).'),
});
type UpdateTransactionsInput = z.infer<typeof updateTransactionsInput>;

const UPDATE_TRANSACTIONS_MUTATION = /* GraphQL */ `
  mutation McpUpdateTransactions($transactionIds: [UUID!]!, $fields: UpdateTransactionInput!) {
    updateTransactions(transactionIds: $transactionIds, fields: $fields) {
      __typename
      ... on UpdatedTransactionsSuccessfulResult {
        deletedChargeIds
        transactions {
          ... on CommonTransaction {
            id
            chargeId
            isFee
            counterparty {
              id
              name
            }
          }
          ... on ConversionTransaction {
            id
            chargeId
            isFee
            counterparty {
              id
              name
            }
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

function transactionFieldsOf(input: UpdateTransactionsInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (input.counterpartyId !== undefined) fields.counterpartyId = input.counterpartyId;
  if (input.chargeId !== undefined) fields.chargeId = input.chargeId;
  if (input.isFee !== undefined) fields.isFee = input.isFee;
  return fields;
}

async function updateTransactionsHandler(
  input: UpdateTransactionsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const fields = transactionFieldsOf(input);
  if (Object.keys(fields).length === 0) {
    throw new ToolInputError('No transaction changes requested', [
      {
        path: 'transactionIds',
        message: 'provide at least one of counterpartyId, chargeId or isFee',
      },
    ]);
  }

  const data = await context.client.mutate<McpUpdateTransactionsMutation>(
    {
      query: UPDATE_TRANSACTIONS_MUTATION,
      variables: { transactionIds: input.transactionIds, fields },
    },
    context.upstream,
  );

  const result = data.updateTransactions;
  if (result.__typename !== 'UpdatedTransactionsSuccessfulResult') {
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      result.__typename === 'CommonError' ? result.message : 'Transaction update failed',
      false,
    );
  }

  const transactions = result.transactions.map(transaction => ({
    id: transaction.id,
    chargeId: transaction.chargeId,
    isFee: transaction.isFee ?? null,
    counterparty: transaction.counterparty
      ? { id: transaction.counterparty.id, name: transaction.counterparty.name }
      : null,
  }));

  const deletedChargeIds = result.deletedChargeIds;

  return shapeWriteResult({
    action: 'update_transactions',
    outcome: {
      updatedCount: transactions.length,
      requestedCount: input.transactionIds.length,
      updatedFields: Object.keys(fields),
      deletedChargeIds,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'transactions', values: transactions },
    summary:
      `Updated ${Object.keys(fields).join(', ')} on ${transactions.length} of ` +
      `${input.transactionIds.length} requested transaction(s).` +
      (deletedChargeIds.length
        ? ` Deleted ${deletedChargeIds.length} former charge(s) the move left empty: ` +
          `${deletedChargeIds.join(', ')}.`
        : ''),
  });
}

function observe(input: UpdateTransactionsInput, result: ToolResult): ToolObservation {
  const structured = result.structuredContent as
    { updatedCount?: number; deletedChargeIds?: string[] } | undefined;
  return {
    fields: {
      requestedTransactionCount: input.transactionIds.length,
      updatedTransactionCount: structured?.updatedCount,
      setsCounterparty: input.counterpartyId !== undefined,
      movesCharge: input.chargeId !== undefined,
      deletedEmptiedChargeCount: structured?.deletedChargeIds?.length ?? 0,
    },
  };
}

export const updateTransactionsTool: ToolDefinition<typeof updateTransactionsInput> = {
  name: UPDATE_TRANSACTIONS_TOOL_NAME,
  description:
    'Set the counterparty, the charge, or the fee flag on one or more bank/card transactions. ' +
    'This is how a charge gets its counterparty: upstream derives a charge’s counterparty from ' +
    'its transactions, so pass the business id as `counterpartyId` (resolve it with ' +
    '`accounter_list_businesses`, or make one with `accounter_create_business`). `chargeId` ' +
    'moves the transactions onto another charge — e.g. an incoming wire onto the charge ' +
    'holding the invoice it pays; upstream deletes former charges the move leaves with no ' +
    'transactions, documents or misc expenses and lists them under `deletedChargeIds`. The ' +
    'all-zero UUID unlinks all the listed transactions into one new charge. Only the fields you pass change. The echo under `transactions` lists each ' +
    'transaction as it now stands (`id`, `chargeId`, `isFee`, `counterparty`), alongside ' +
    '`updatedCount`, `requestedCount`, `updatedFields` and `deletedChargeIds`. ' +
    writeResultDescription('transactions') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: updateTransactionsInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: updateTransactionsHandler,
  observe,
};
