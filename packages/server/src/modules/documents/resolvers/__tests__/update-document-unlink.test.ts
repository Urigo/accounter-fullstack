import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_UUID } from '../../../../shared/constants.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { deleteCharges } from '../../../charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { DocumentsProvider } from '../../providers/documents.provider.js';
import { documentsResolvers } from '../documents.resolver.js';

/**
 * `updateDocument` unlink path (`fields.chargeId === EMPTY_UUID`).
 *
 * Unlinking a charge's only document leaves that charge empty, so the resolver moves the document
 * to a freshly generated charge and deletes the former one — reporting it back as
 * `deletedChargeId` so the client drops the row instead of refetching a charge that no longer
 * exists. The deletion is deferred through a mutable `postUpdateActions` closure, which once ended
 * by calling itself: the tail call read the variable it had just been assigned to, so the mutation
 * never resolved and re-ran `deleteCharges` forever (the helper is idempotent, so nothing ever
 * threw to break the loop). The call-count assertion is what pins that down.
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
const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';

function contextWithSoleDocument({ transactions = [] }: { transactions?: unknown[] } = {}) {
  const document = { id: DOCUMENT_ID, charge_id: FORMER_CHARGE_ID };
  const updateDocument = vi.fn().mockResolvedValue([document]);
  const generateCharge = vi.fn().mockResolvedValue({ id: NEW_CHARGE_ID, owner_id: OWNER_ID });

  const injector = {
    get: (token: unknown) => {
      if (token === DocumentsProvider) {
        return {
          getDocumentsByIdLoader: { load: vi.fn().mockResolvedValue(document) },
          getDocumentsByChargeIdLoader: { load: vi.fn().mockResolvedValue([document]) },
          updateDocument,
        };
      }
      if (token === ChargesProvider) {
        return {
          getChargeByIdLoader: {
            load: vi.fn().mockResolvedValue({ id: FORMER_CHARGE_ID, owner_id: OWNER_ID }),
          },
          generateCharge,
        };
      }
      if (token === TransactionsProvider) {
        return { transactionsByChargeIDLoader: { load: vi.fn().mockResolvedValue(transactions) } };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;

  return { context: { injector } as never, updateDocument, generateCharge };
}

function unlinkDocument(context: unknown): Promise<unknown> {
  const resolver = documentsResolvers.Mutation!.updateDocument!;
  const resolve = typeof resolver === 'function' ? resolver : resolver.resolve;
  return (
    resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => Promise<unknown>
  )({}, { documentId: DOCUMENT_ID, fields: { chargeId: EMPTY_UUID } }, context, {});
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
});
