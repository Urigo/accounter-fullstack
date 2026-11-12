import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addGreenInvoiceClient } from '../../../green-invoice/helpers/green-invoice-clients.helper.js';
import { ClientsProvider } from '../../providers/clients.provider.js';
import { clientsResolvers } from '../clients.resolvers.js';

vi.mock('../../../green-invoice/helpers/green-invoice-clients.helper.js', () => ({
  addGreenInvoiceClient: vi.fn(),
  updateGreenInvoiceClient: vi.fn(),
}));

/**
 * `insertClient` inserts the row and only then creates the Green Invoice customer,
 * writing its id onto the row. The mutation must return the row as it stands after
 * that step — the inserted row has no Green Invoice id, so returning it reports
 * `greenInvoiceInfo: null` for a client that has one.
 */

const BUSINESS_ID = 'aa000000-0000-4000-8000-000000000001';
const GREEN_INVOICE_ID = 'bb000000-0000-4000-8000-000000000001';

function callInsertClient(injector: Injector): Promise<unknown> {
  const resolver = clientsResolvers.Mutation?.insertClient as unknown;
  const resolve =
    typeof resolver === 'function' ? resolver : (resolver as { resolve: unknown }).resolve;
  return (resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => Promise<unknown>)(
    {},
    { fields: { businessId: BUSINESS_ID, generatedDocumentType: 'PROFORMA' } },
    { injector },
    {},
  );
}

describe('insertClient', () => {
  const insertClient = vi.fn();
  const load = vi.fn();
  const injector = {
    get: (token: unknown) => {
      if (token === ClientsProvider) {
        return { insertClient, getClientByIdLoader: { load } };
      }
      throw new Error(`Unexpected provider ${String(token)}`);
    },
  } as unknown as Injector;

  beforeEach(() => {
    insertClient.mockReset().mockResolvedValue([{ business_id: BUSINESS_ID, integrations: {} }]);
    load.mockReset();
    vi.mocked(addGreenInvoiceClient).mockReset();
  });

  it('returns the row as updated by the Green Invoice step, not as inserted', async () => {
    const updated = { business_id: BUSINESS_ID, integrations: { greenInvoiceId: GREEN_INVOICE_ID } };
    load.mockResolvedValue(updated);

    await expect(callInsertClient(injector)).resolves.toBe(updated);
    expect(load).toHaveBeenCalledWith(BUSINESS_ID);
    // The reload must come after the Green Invoice step, or it reads the stale row.
    expect(vi.mocked(addGreenInvoiceClient).mock.invocationCallOrder[0]).toBeLessThan(
      load.mock.invocationCallOrder[0]!,
    );
  });

  it('reports a failure, without reloading, when the Green Invoice step fails', async () => {
    vi.mocked(addGreenInvoiceClient).mockRejectedValue(new Error('Green Invoice is down'));

    await expect(callInsertClient(injector)).resolves.toMatchObject({ __typename: 'CommonError' });
    expect(load).not.toHaveBeenCalled();
  });
});
