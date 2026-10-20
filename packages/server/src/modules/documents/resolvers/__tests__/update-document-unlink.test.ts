import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_UUID } from '../../../../shared/constants.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { deleteCharges } from '../../../charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { MiscExpensesProvider } from '../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { DocumentsProvider } from '../../providers/documents.provider.js';
import { documentsResolvers } from '../documents.resolver.js';

/**
 * `updateDocument` moving a document off its charge (unlink via `EMPTY_UUID`, or move to another
 * existing charge).
 *
 * Moving a charge's only record leaves that charge empty, so the resolver deletes the former one
 * after the update (via `deleteChargesIfEmpty`) — reporting it back as `deletedChargeId` so the
 * client drops the row instead of refetching a charge that no longer exists. The deletion once ran
 * through a mutable `postUpdateActions` closure that ended by calling itself, so the mutation never
 * resolved and re-ran `deleteCharges` forever (the helper is idempotent, so nothing ever threw to
 * break the loop). The call-count assertion is what pins that down.
 */

// The resolver module pulls in the Green Invoice client, whose generated mesh artifacts only exist
// after `yarn build:tools`. Nothing on the unlink path touches it, so stub the provider token out
// rather than making this unit test depend on a build step.
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
const NEW_CHARGE_ID = 'cc000000-0000-4000-8000-000000000002';
const OTHER_CHARGE_ID = 'cc000000-0000-4000-8000-000000000003';
const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';

function contextWithSoleDocument({ transactions = [] }: { transactions?: unknown[] } = {}) {
  const document = { id: DOCUMENT_ID, charge_id: FORMER_CHARGE_ID };
  const updateDocument = vi.fn().mockResolvedValue([document]);
  const generateCharge = vi.fn().mockResolvedValue({ id: NEW_CHARGE_ID, owner_id: OWNER_ID });

  // after the update the document no longer sits on its former charge
  const byChargeId = (rows: unknown[]) => ({
    load: vi.fn(async (chargeId: string) => (chargeId === FORMER_CHARGE_ID ? rows : [{}])),
    clear: vi.fn(),
  });

  const injector = {
    get: (token: unknown) => {
      if (token === DocumentsProvider) {
        return {
          getDocumentsByIdLoader: { load: vi.fn().mockResolvedValue(document) },
          getDocumentsByChargeIdLoader: byChargeId([]),
          updateDocument,
        };
      }
      if (token === ChargesProvider) {
        return {
          getChargeByIdLoader: {
            load: vi.fn(async (id: string) => ({ id, owner_id: OWNER_ID })),
          },
          generateCharge,
          invalidateCharge: vi.fn(),
        };
      }
      if (token === TransactionsProvider) {
        return { transactionsByChargeIDLoader: byChargeId(transactions) };
      }
      if (token === MiscExpensesProvider) {
        return { getExpensesByChargeIdLoader: byChargeId([]) };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;

  return { context: { injector } as never, updateDocument, generateCharge };
}

function moveDocument(context: unknown, chargeId: string): Promise<unknown> {
  const resolver = documentsResolvers.Mutation!.updateDocument!;
  const resolve = typeof resolver === 'function' ? resolver : resolver.resolve;
  return (
    resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => Promise<unknown>
  )({}, { documentId: DOCUMENT_ID, fields: { chargeId } }, context, {});
}

function unlinkDocument(context: unknown): Promise<unknown> {
  return moveDocument(context, EMPTY_UUID);
}

describe('Mutation.updateDocument — unlinking the charge’s last document', () => {
  beforeEach(() => {
    vi.mocked(deleteCharges).mockReset().mockResolvedValue(undefined);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('deletes the emptied former charge exactly once and reports it back', async () => {
    const { context } = contextWithSoleDocument();

    const result = await unlinkDocument(context);

    expect(deleteCharges).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledWith([FORMER_CHARGE_ID], expect.anything());
    expect(result).toMatchObject({ deletedChargeId: FORMER_CHARGE_ID });
  }, 5000);

  it('keeps a charge that still holds a transaction', async () => {
    const { context } = contextWithSoleDocument({ transactions: [{ id: 'tx1' }] });

    const result = await unlinkDocument(context);

    expect(deleteCharges).not.toHaveBeenCalled();
    expect(result).toMatchObject({ deletedChargeId: null });
  }, 5000);

  it('deletes the emptied former charge when moving to another existing charge', async () => {
    const { context, generateCharge } = contextWithSoleDocument();

    const result = await moveDocument(context, OTHER_CHARGE_ID);

    expect(generateCharge).not.toHaveBeenCalled();
    expect(deleteCharges).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledWith([FORMER_CHARGE_ID], expect.anything());
    expect(result).toMatchObject({ deletedChargeId: FORMER_CHARGE_ID });
  }, 5000);
});
