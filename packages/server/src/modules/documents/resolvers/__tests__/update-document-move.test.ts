import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { deleteCharges } from '../../../charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { MiscExpensesProvider } from '../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { DocumentsProvider } from '../../providers/documents.provider.js';
import { documentsResolvers } from '../documents.resolver.js';

/**
 * `updateDocument` moving a document onto an existing charge (`fields.chargeId` set to a real id).
 *
 * The unlink path (see `update-document-unlink.test.ts`) has always deleted a former charge it
 * emptied. A move onto a real charge used not to: a receipt that OCR landed in its own charge and
 * was then attached to the charge holding the card row left the receipt-only charge behind, empty.
 * The resolver now deletes a former charge left with no transactions, documents or misc expenses
 * after any move and reports it as `deletedChargeId`, so the client drops the row.
 */

// See update-document-unlink.test.ts: the resolver module imports the Green Invoice client, whose
// mesh artifacts only exist after `yarn build:tools`. Nothing on this path touches it.
vi.mock('../../../app-providers/green-invoice-client.js', () => ({
  GreenInvoiceClientProvider: class GreenInvoiceClientProvider {},
}));

vi.mock('../../../charges/helpers/delete-charges.helper.js', () => ({
  deleteCharges: vi.fn(),
}));

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const DOCUMENT_ID = 'dd000000-0000-4000-8000-000000000001';
const FORMER_CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const TARGET_CHARGE_ID = 'cc000000-0000-4000-8000-000000000002';
const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';

/** Loaders answer with the state after the move: the document sits on the target. */
function contextAfterMove({
  transactionsLeft = [] as unknown[],
  documentsLeft = [] as unknown[],
  miscExpensesLeft = [] as unknown[],
} = {}) {
  const document = { id: DOCUMENT_ID, charge_id: FORMER_CHARGE_ID };
  const updateDocument = vi.fn().mockResolvedValue([{ ...document, charge_id: TARGET_CHARGE_ID }]);
  const loader = (rows: unknown[]) => ({
    load: vi.fn().mockResolvedValue(rows),
    clear: vi.fn(),
  });

  const injector = {
    get: (token: unknown) => {
      if (token === DocumentsProvider) {
        return {
          getDocumentsByIdLoader: { load: vi.fn().mockResolvedValue(document) },
          getDocumentsByChargeIdLoader: loader(documentsLeft),
          updateDocument,
        };
      }
      if (token === ChargesProvider) {
        return {
          getChargeByIdLoader: {
            load: vi.fn(async (id: string) => ({ id, owner_id: OWNER_ID })),
          },
        };
      }
      if (token === TransactionsProvider) {
        return { transactionsByChargeIDLoader: loader(transactionsLeft) };
      }
      if (token === MiscExpensesProvider) {
        return { getExpensesByChargeIdLoader: loader(miscExpensesLeft) };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;

  return { context: { injector } as never, updateDocument };
}

function moveDocument(context: unknown, chargeId = TARGET_CHARGE_ID): Promise<unknown> {
  const resolver = documentsResolvers.Mutation!.updateDocument!;
  const resolve = typeof resolver === 'function' ? resolver : resolver.resolve;
  return (
    resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => Promise<unknown>
  )({}, { documentId: DOCUMENT_ID, fields: { chargeId } }, context, {});
}

describe('Mutation.updateDocument — moving onto an existing charge', () => {
  beforeEach(() => {
    vi.mocked(deleteCharges).mockReset().mockResolvedValue(undefined);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('deletes the former charge the move left empty and reports it', async () => {
    const { context, updateDocument } = contextAfterMove();

    const result = await moveDocument(context);

    expect(updateDocument).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledWith([FORMER_CHARGE_ID], expect.anything());
    expect(result).toMatchObject({ deletedChargeId: FORMER_CHARGE_ID });
  });

  it('keeps a former charge that still holds a transaction', async () => {
    const { context } = contextAfterMove({ transactionsLeft: [{ id: 'tx1' }] });

    const result = await moveDocument(context);

    expect(deleteCharges).not.toHaveBeenCalled();
    expect(result).toMatchObject({ deletedChargeId: null });
  });

  it('keeps a former charge that still holds a misc expense', async () => {
    const { context } = contextAfterMove({ miscExpensesLeft: [{ id: 'expense' }] });

    const result = await moveDocument(context);

    expect(deleteCharges).not.toHaveBeenCalled();
    expect(result).toMatchObject({ deletedChargeId: null });
  });

  it('does nothing when the document stays on its charge', async () => {
    const { context } = contextAfterMove();

    const result = await moveDocument(context, FORMER_CHARGE_ID);

    expect(deleteCharges).not.toHaveBeenCalled();
    expect(result).toMatchObject({ deletedChargeId: null });
  });
});
