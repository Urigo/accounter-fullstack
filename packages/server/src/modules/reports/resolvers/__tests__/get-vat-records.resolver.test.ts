import type { Injector } from 'graphql-modules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentType } from '../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { BusinessTripsProvider } from '../../../business-trips/providers/business-trips.provider.js';
import { validateCharge } from '../../../charges/helpers/validate.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { BusinessesProvider } from '../../../financial-entities/providers/businesses.provider.js';
import { adjustTaxRecord, type RawVatReportRecord } from '../../helpers/vat-report.helper.js';
import { getVatRecords } from '../get-vat-records.resolver.js';

vi.mock('../../../charges/helpers/common.helper.js', () => ({
  getChargeBusinesses: vi.fn(async () => ({ allBusinessIds: [] })),
}));

const { defaultAdjustTaxRecord } = vi.hoisted(() => ({
  defaultAdjustTaxRecord: async ({ doc }: { doc: { id: string } }) =>
    ({ documentId: doc.id }) as RawVatReportRecord,
}));

// The tax adjustment needs exchange rates and VAT values; these tests are about which documents
// make it into the month, so a record that names its document is enough.
vi.mock('../../helpers/vat-report.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../helpers/vat-report.helper.js')>()),
  adjustTaxRecord: vi.fn(defaultAdjustTaxRecord),
}));

vi.mock('../../../charges/helpers/validate.helper.js', () => ({
  validateCharge: vi.fn(async () => ({ isValid: true })),
}));

const OWNER_ID = 'owner-1';
const SUPPLIER_ID = 'supplier-1';

/** An expense invoice whose VAT report date is overridden to `override`. */
function expenseInvoice(id: string, override: TimelessDateString) {
  return {
    id,
    charge_id: `charge-${id}`,
    owner_id: OWNER_ID,
    creditor_id: SUPPLIER_ID,
    debtor_id: OWNER_ID,
    type: DocumentType.Invoice,
    vat_amount: 17,
    total_amount: 117 as number | null,
    currency_code: 'ILS' as string | null,
    date: override as TimelessDateString | null,
    vat_report_date_override: override,
  };
}

function createInjector(documents: Array<ReturnType<typeof expenseInvoice>>) {
  const getDocumentsByFilters = vi.fn().mockResolvedValue(documents);
  const getChargesByFilters = vi
    .fn()
    .mockResolvedValue(documents.map(doc => ({ id: doc.charge_id, user_description: null })));

  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: vi
          .fn()
          .mockResolvedValue({ authorities: { vatReportExcludedBusinessNames: [] } }),
      },
    ],
    [DocumentsProvider, { getDocumentsByFilters }],
    [BusinessesProvider, { getAllBusinesses: vi.fn().mockResolvedValue([{ id: SUPPLIER_ID }]) }],
    [ChargesProvider, { getChargesByFilters }],
    [
      BusinessTripsProvider,
      { getBusinessTripsByChargeIdLoader: { load: vi.fn().mockResolvedValue(null) } },
    ],
  ]);

  const injector = {
    get: vi.fn((token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected injector token: ${String(token)}`);
      }
      return providers.get(token);
    }),
  } as unknown as Injector;

  return { injector, getDocumentsByFilters, getChargesByFilters };
}

describe.each(['UTC', 'Asia/Jerusalem', 'America/New_York'])('getVatRecords (TZ=%s)', timeZone => {
  let previousTimeZone: string | undefined;

  beforeEach(() => {
    previousTimeZone = process.env.TZ;
    process.env.TZ = timeZone;
  });

  afterEach(() => {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  });

  it.each(['2024-01-01', '2024-01-15', '2024-01-31'] as TimelessDateString[])(
    'queries January for a month date of %s',
    async monthDate => {
      const { injector, getDocumentsByFilters, getChargesByFilters } = createInjector([]);

      await getVatRecords({ filters: { monthDate, financialEntityId: OWNER_ID } }, injector, {
        includeChargeBuckets: false,
      });

      expect(getDocumentsByFilters).toHaveBeenCalledWith({
        fromVatDate: '2024-01-01',
        toVatDate: '2024-01-31',
      });
      expect(getChargesByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ fromDate: '2024-01-01', toDate: '2024-01-31' }),
      );
    },
  );

  it('keeps documents whose VAT date override falls inside the month, first and last day included', async () => {
    const { injector } = createInjector([
      expenseInvoice('dec-31', '2023-12-31'),
      expenseInvoice('jan-01', '2024-01-01'),
      expenseInvoice('jan-31', '2024-01-31'),
      expenseInvoice('feb-01', '2024-02-01'),
    ]);

    const { expenses, income } = await getVatRecords(
      { filters: { monthDate: '2024-01-01', financialEntityId: OWNER_ID } },
      injector,
      { includeChargeBuckets: false },
    );

    expect(expenses.map(record => record.documentId).sort()).toEqual(['jan-01', 'jan-31']);
    expect(income).toEqual([]);
  });
});

/**
 * Stands in for the request's TenantAwareDBClient: the cleanup plugin disposes it as soon as the
 * request settles, and any query after that is the "already disposed" cascade of #4871.
 */
function requestScopedClient() {
  let disposed = false;
  const queriesAfterDisposal: string[] = [];
  return {
    query(sql: string) {
      if (disposed) {
        queriesAfterDisposal.push(sql);
      }
    },
    dispose() {
      disposed = true;
    },
    queriesAfterDisposal,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('getVatRecords fan-outs', () => {
  const filters = { monthDate: '2024-01-01' as TimelessDateString, financialEntityId: OWNER_ID };

  afterEach(() => {
    vi.mocked(adjustTaxRecord).mockImplementation(defaultAdjustTaxRecord as never);
    vi.mocked(validateCharge).mockImplementation(async () => ({ isValid: true }) as never);
    vi.restoreAllMocks();
  });

  it('issues no query after the request ends when one charge validation rejects', async () => {
    const db = requestScopedClient();
    const sibling = deferred();
    vi.mocked(validateCharge).mockImplementation((async (charge: { id: string }) => {
      if (charge.id === 'charge-bad') {
        throw new Error('validation failed');
      }
      await sibling.promise;
      db.query('SELECT ledger');
      return { isValid: true };
    }) as never);
    const { injector } = createInjector([
      expenseInvoice('bad', '2024-01-10'),
      expenseInvoice('good', '2024-01-11'),
    ]);

    setTimeout(sibling.resolve, 20);
    await expect(getVatRecords({ filters }, injector).finally(db.dispose)).rejects.toThrow(
      'validation failed',
    );
    // Give a sibling that outlived the request the chance to query.
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(db.queriesAfterDisposal).toEqual([]);
  });

  it('issues no query after the request ends when one tax adjustment rejects', async () => {
    const db = requestScopedClient();
    const sibling = deferred();
    vi.mocked(adjustTaxRecord).mockImplementation((async ({ doc }: { doc: { id: string } }) => {
      if (doc.id === 'bad') {
        throw new Error('VAT value is missing');
      }
      await sibling.promise;
      db.query('SELECT exchange_rates');
      return { documentId: doc.id } as RawVatReportRecord;
    }) as never);
    const { injector } = createInjector([
      expenseInvoice('bad', '2024-01-10'),
      expenseInvoice('good', '2024-01-11'),
    ]);

    setTimeout(sibling.resolve, 20);
    await expect(
      getVatRecords({ filters }, injector, { includeChargeBuckets: false }).finally(db.dispose),
    ).rejects.toThrow('VAT value is missing');
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(db.queriesAfterDisposal).toEqual([]);
  });

  it('logs a failed tax adjustment exactly once', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(adjustTaxRecord).mockRejectedValue(new Error('VAT value is missing'));
    const { injector } = createInjector([expenseInvoice('bad', '2024-01-10')]);

    await expect(
      getVatRecords({ filters }, injector, { includeChargeBuckets: false }),
    ).rejects.toThrow('VAT value is missing');

    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe('getVatRecords with incomplete documents (#4946)', () => {
  const filters = { monthDate: '2024-01-01' as TimelessDateString, financialEntityId: OWNER_ID };

  function noCurrency(id: string, date: TimelessDateString) {
    return { ...expenseInvoice(id, date), currency_code: null };
  }

  it('reports the rest of the month and lists a document without a currency under missingInfo', async () => {
    const { injector } = createInjector([
      expenseInvoice('good-1', '2024-01-10'),
      noCurrency('no-currency', '2024-01-11'),
      expenseInvoice('good-2', '2024-01-12'),
    ]);

    const report = await getVatRecords({ filters }, injector);

    expect(report.expenses.map(record => record.documentId).sort()).toEqual(['good-1', 'good-2']);
    expect(report.income).toEqual([]);
    expect(report.missingInfo.map(charge => charge.id)).toEqual(['charge-no-currency']);
    // A charge-level validation that passes must not move it to differentMonthDoc instead.
    expect(report.differentMonthDoc).toEqual([]);
    expect(report.incompleteDocuments).toEqual([
      { documentId: 'no-currency', chargeId: 'charge-no-currency', missingFields: ['currency'] },
    ]);
    expect(adjustTaxRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ doc: expect.objectContaining({ id: 'no-currency' }) }),
      injector,
    );
  });

  it('sets aside documents missing an amount or a date the same way', async () => {
    const { injector } = createInjector([
      { ...expenseInvoice('no-amount', '2024-01-10'), total_amount: null },
      { ...expenseInvoice('no-date', '2024-01-11'), date: null },
      expenseInvoice('good', '2024-01-12'),
    ]);

    const report = await getVatRecords({ filters }, injector);

    expect(report.expenses.map(record => record.documentId)).toEqual(['good']);
    expect(report.missingInfo.map(charge => charge.id).sort()).toEqual([
      'charge-no-amount',
      'charge-no-date',
    ]);
    expect(report.incompleteDocuments.map(doc => doc.missingFields)).toEqual([
      ['amount'],
      ['date'],
    ]);
  });

  it('still reports incomplete documents when the charge buckets are skipped', async () => {
    const { injector } = createInjector([
      expenseInvoice('good', '2024-01-10'),
      noCurrency('no-currency', '2024-01-11'),
    ]);

    const report = await getVatRecords({ filters }, injector, { includeChargeBuckets: false });

    expect(report.expenses.map(record => record.documentId)).toEqual(['good']);
    expect(report.missingInfo).toEqual([]);
    expect(report.incompleteDocuments.map(doc => doc.documentId)).toEqual(['no-currency']);
  });
});

