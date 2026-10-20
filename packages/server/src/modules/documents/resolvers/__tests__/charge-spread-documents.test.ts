import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { deleteChargesIfEmpty } from '../../../charges/helpers/delete-empty-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { DocumentsProvider } from '../../providers/documents.provider.js';
import { documentsResolvers } from '../documents.resolver.js';

/**
 * `Mutation.chargeSpreadDocuments` moves every document not kept onto its own new charge. When
 * nothing is kept and the original charge holds nothing else, that leaves it empty: it is handed to
 * `deleteChargesIfEmpty` and, once deleted, left out of the returned charges.
 */

// The resolver module pulls in the Green Invoice client, whose generated mesh artifacts only exist
// after `yarn build:tools`. Nothing on this path touches it.
vi.mock('../../../app-providers/green-invoice-client.js', () => ({
  GreenInvoiceClientProvider: class GreenInvoiceClientProvider {},
}));

vi.mock('../../../charges/helpers/delete-empty-charges.helper.js', () => ({
  deleteChargesIfEmpty: vi.fn(),
}));

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';
const DOCS = ['dd000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000002'];

function buildContext() {
  let generated = 0;
  const injector = {
    get: (token: unknown) => {
      if (token === ChargesProvider) {
        return {
          getChargeByIdLoader: {
            load: vi.fn(async (id: string) => ({ id, owner_id: OWNER_ID })),
            loadMany: vi.fn(async (ids: string[]) => ids.map(id => ({ id, owner_id: OWNER_ID }))),
          },
          generateCharge: vi.fn(async () => ({ id: `new-${++generated}`, owner_id: OWNER_ID })),
        };
      }
      if (token === DocumentsProvider) {
        return {
          getDocumentsByChargeIdLoader: {
            load: vi.fn().mockResolvedValue(DOCS.map(id => ({ id, owner_id: OWNER_ID }))),
          },
          updateDocument: vi.fn(async ({ documentId }: { documentId: string }) => [
            { id: documentId },
          ]),
        };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { injector } as never;
}

const chargeSpreadDocuments = documentsResolvers.Mutation!.chargeSpreadDocuments as unknown as (
  parent: unknown,
  args: { chargeId: string; documentIdsToKeep?: string[] },
  context: unknown,
) => Promise<Array<{ id: string }>>;

describe('Mutation.chargeSpreadDocuments', () => {
  beforeEach(() => {
    vi.mocked(deleteChargesIfEmpty).mockReset();
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('deletes the emptied original charge and leaves it out of the result', async () => {
    vi.mocked(deleteChargesIfEmpty).mockResolvedValue([CHARGE_ID]);

    const charges = await chargeSpreadDocuments(null, { chargeId: CHARGE_ID }, buildContext());

    expect(deleteChargesIfEmpty).toHaveBeenCalledWith([CHARGE_ID], expect.anything());
    expect(charges.map(c => c.id)).toEqual(['new-1', 'new-2']);
  });

  it('keeps the original charge when it still holds records', async () => {
    vi.mocked(deleteChargesIfEmpty).mockResolvedValue([]);

    const charges = await chargeSpreadDocuments(
      null,
      { chargeId: CHARGE_ID, documentIdsToKeep: [DOCS[0]] },
      buildContext(),
    );

    expect(charges.map(c => c.id)).toEqual([CHARGE_ID, 'new-1']);
  });
});
