import type { Injector } from 'graphql-modules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentType } from '../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { BusinessesProvider } from '../../../financial-entities/providers/businesses.provider.js';
import type { RawVatReportRecord } from '../../helpers/vat-report.helper.js';
import { getVatRecords } from '../get-vat-records.resolver.js';

vi.mock('../../../charges/helpers/common.helper.js', () => ({
  getChargeBusinesses: vi.fn(async () => ({ allBusinessIds: [] })),
}));

// The tax adjustment needs exchange rates and VAT values; these tests are about which documents
// make it into the month, so a record that names its document is enough.
vi.mock('../../helpers/vat-report.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../helpers/vat-report.helper.js')>()),
  adjustTaxRecord: vi.fn(
    async ({ doc }: { doc: { id: string } }) => ({ documentId: doc.id }) as RawVatReportRecord,
  ),
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
    total_amount: 117,
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
