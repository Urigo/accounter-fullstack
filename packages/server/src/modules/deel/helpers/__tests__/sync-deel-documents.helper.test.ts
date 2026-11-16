import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice, PaymentReceipts } from '../../../app-providers/deel/schemas.js';
import { deleteChargesIfEmpty } from '../../../charges/helpers/delete-empty-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import {
  fetchAndFilterInvoices,
  fetchPaymentBreakdowns,
  fetchReceipts,
  getChargeMatchesForPayments,
  insertDeelInvoiceRecord,
  matchInvoicesWithPayments,
  updateDeelInvoiceRecord,
  type DeelInvoiceMatch,
} from '../deel.helper.js';
import { syncDeelDocuments } from '../sync-deel-documents.helper.js';

vi.mock('../deel.helper.js', () => ({
  createDeelInvoiceMatchFromUnmatchedInvoice: vi.fn((invoice: Invoice) => invoice),
  fetchAndFilterInvoices: vi.fn(),
  fetchPaymentBreakdowns: vi.fn(),
  fetchReceipts: vi.fn(),
  getChargeMatchesForPayments: vi.fn(),
  getContractsFromPaymentBreakdowns: vi.fn(() => []),
  getDeelChargeDescription: vi.fn(async () => 'Deel payment for Dana'),
  insertDeelInvoiceRecord: vi.fn(),
  matchInvoicesWithPayments: vi.fn(),
  updateDeelInvoiceRecord: vi.fn(),
  validateContracts: vi.fn(),
}));
vi.mock('../../../charges/helpers/delete-empty-charges.helper.js', () => ({
  deleteChargesIfEmpty: vi.fn(),
}));

const invoice = (id: string) => ({ id, label: `INV-${id}` }) as Invoice;
const match = (id: string, receiptId: string) =>
  ({ id, label: `INV-${id}`, breakdown_receipt_id: receiptId }) as DeelInvoiceMatch;
const receipt = (id: string) => ({ id, workers: [] }) as unknown as PaymentReceipts;

function buildCharge(id: string): IGetChargesByIdsResult {
  return { id, user_description: `charge ${id}` } as IGetChargesByIdsResult;
}

function buildInjector() {
  let generated = 0;
  const generateCharge = vi.fn(async () => ({ id: `new-charge-${++generated}` }));
  const chargesProvider = {
    generateCharge,
    getChargeByIdLoader: { loadMany: async (ids: string[]) => ids.map(buildCharge) },
  };
  const injector = {
    get: (token: unknown) => (token === ChargesProvider ? chargesProvider : undefined),
  } as unknown as Injector;
  return { injector, generateCharge };
}

describe('syncDeelDocuments', () => {
  beforeEach(() => {
    vi.mocked(fetchReceipts).mockReset().mockResolvedValue([]);
    vi.mocked(fetchPaymentBreakdowns).mockReset().mockResolvedValue([]);
    vi.mocked(insertDeelInvoiceRecord).mockReset();
    vi.mocked(updateDeelInvoiceRecord).mockReset();
    vi.mocked(deleteChargesIfEmpty).mockReset().mockResolvedValue([]);
    vi.mocked(getChargeMatchesForPayments).mockReset().mockResolvedValue({
      receiptChargeMap: new Map(),
      invoiceChargeMap: new Map(),
      newReceipts: [],
    });
  });

  it('skips the Deel API when there are no new or unmatched invoices', async () => {
    vi.mocked(fetchAndFilterInvoices).mockResolvedValue({
      newInvoices: [],
      unmatchedExistingInvoices: [],
    });
    const { injector } = buildInjector();

    await expect(syncDeelDocuments(injector, 'owner-1')).resolves.toEqual({ charges: [] });
    expect(fetchReceipts).not.toHaveBeenCalled();
  });

  it('reports which charges were created and how many invoices each got', async () => {
    vi.mocked(fetchAndFilterInvoices).mockResolvedValue({
      newInvoices: [invoice('a'), invoice('b'), invoice('c'), invoice('d')],
      unmatchedExistingInvoices: [invoice('e')],
    });
    vi.mocked(fetchReceipts).mockResolvedValue([receipt('r-new')]);
    vi.mocked(matchInvoicesWithPayments).mockResolvedValue({
      // a, b: paid by a receipt already linked to a charge; c: paid by a new receipt;
      // e: an existing unmatched invoice that is now matched
      matches: [match('a', 'r-old'), match('b', 'r-old'), match('c', 'r-new'), match('e', 'r-old')],
      // d: not paid yet
      unmatched: [invoice('d')],
    });
    vi.mocked(getChargeMatchesForPayments).mockResolvedValue({
      receiptChargeMap: new Map([['r-old', 'existing-charge']]),
      invoiceChargeMap: new Map(),
      newReceipts: [receipt('r-new')],
    });
    const { injector, generateCharge } = buildInjector();

    const { charges } = await syncDeelDocuments(injector, 'owner-1');

    expect(charges.map(({ charge, isNew, invoiceCount }) => [charge.id, isNew, invoiceCount])).toEqual(
      [
        ['new-charge-1', true, 1], // invoice d
        ['existing-charge', false, 3], // invoices a, b, e
        ['new-charge-2', true, 1], // invoice c
      ],
    );
    expect(generateCharge).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      userDescription: 'Deel invoice INV-d',
    });
    expect(generateCharge).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      userDescription: 'Deel payment for Dana',
    });
    expect(updateDeelInvoiceRecord).toHaveBeenCalledTimes(1);
    expect(insertDeelInvoiceRecord).toHaveBeenCalledTimes(4);
  });

  it('leaves out charges deleted as empty', async () => {
    vi.mocked(fetchAndFilterInvoices).mockResolvedValue({
      newInvoices: [invoice('a'), invoice('b')],
      unmatchedExistingInvoices: [],
    });
    vi.mocked(matchInvoicesWithPayments).mockResolvedValue({
      matches: [],
      unmatched: [invoice('a'), invoice('b')],
    });
    vi.mocked(deleteChargesIfEmpty).mockResolvedValue(['new-charge-1']);
    const { injector } = buildInjector();

    const { charges } = await syncDeelDocuments(injector, 'owner-1');

    expect(deleteChargesIfEmpty).toHaveBeenCalledWith(['new-charge-1', 'new-charge-2'], injector);
    expect(charges.map(({ charge }) => charge.id)).toEqual(['new-charge-2']);
  });

  it('does not create a charge for an already-recorded invoice that is still unmatched', async () => {
    vi.mocked(fetchAndFilterInvoices).mockResolvedValue({
      newInvoices: [],
      unmatchedExistingInvoices: [invoice('e')],
    });
    vi.mocked(matchInvoicesWithPayments).mockResolvedValue({
      matches: [],
      unmatched: [invoice('e')],
    });
    const { injector, generateCharge } = buildInjector();

    await expect(syncDeelDocuments(injector, 'owner-1')).resolves.toEqual({ charges: [] });
    expect(generateCharge).not.toHaveBeenCalled();
    expect(insertDeelInvoiceRecord).not.toHaveBeenCalled();
  });
});
