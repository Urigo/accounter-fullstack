import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateGreenInvoiceClient } from '../../../green-invoice/helpers/green-invoice-clients.helper.js';
import { ClientsProvider } from '../../providers/clients.provider.js';
import { clientsResolvers } from '../clients.resolvers.js';

vi.mock('../../../green-invoice/helpers/green-invoice-clients.helper.js', () => ({
  addGreenInvoiceClient: vi.fn(),
  updateGreenInvoiceClient: vi.fn(),
}));

/**
 * `updateClient` writes the client's emails twice: to the local row and, through
 * `updateGreenInvoiceClient`, to Green Invoice. Both must get the same
 * de-duplicated list, or Green Invoice keeps duplicate billing addresses that the
 * local client no longer has.
 */

const BUSINESS_ID = 'aa000000-0000-4000-8000-000000000001';

function callUpdateClient(fields: Record<string, unknown>, injector: Injector): Promise<unknown> {
  const resolver = clientsResolvers.Mutation?.updateClient as unknown;
  const resolve =
    typeof resolver === 'function' ? resolver : (resolver as { resolve: unknown }).resolve;
  return (resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => Promise<unknown>)(
    {},
    { businessId: BUSINESS_ID, fields },
    { injector },
    {},
  );
}

describe('updateClient emails', () => {
  const updateClient = vi.fn();
  const injector = {
    get: (token: unknown) => {
      if (token === ClientsProvider) {
        return { updateClient };
      }
      throw new Error(`Unexpected provider ${String(token)}`);
    },
  } as unknown as Injector;

  beforeEach(() => {
    updateClient.mockReset().mockResolvedValue([{ business_id: BUSINESS_ID }]);
    vi.mocked(updateGreenInvoiceClient).mockReset();
  });

  it('sends the same de-duplicated emails to the local row and to Green Invoice', async () => {
    await callUpdateClient(
      { emails: ['billing@acme.com', 'Billing@Acme.com', 'ops@acme.com'] },
      injector,
    );

    const expected = ['billing@acme.com', 'ops@acme.com'];
    expect(updateClient).toHaveBeenCalledWith(expect.objectContaining({ emails: expected }));
    expect(updateGreenInvoiceClient).toHaveBeenCalledWith(
      BUSINESS_ID,
      injector,
      undefined,
      expect.objectContaining({ emails: expected }),
    );
  });

  it('leaves emails untouched when the update does not set them', async () => {
    await callUpdateClient({ generatedDocumentType: 'INVOICE' }, injector);

    expect(updateClient.mock.calls[0]?.[0]?.emails).toBeUndefined();
    expect(vi.mocked(updateGreenInvoiceClient).mock.calls[0]?.[3]?.emails).toBeUndefined();
  });
});
