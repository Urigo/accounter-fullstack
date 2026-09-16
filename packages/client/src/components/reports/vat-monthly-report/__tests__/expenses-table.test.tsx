import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpensesTable } from '../expenses-section/expenses-table.js';

// The charge detail panel only mounts on expansion, but it pulls urql in through its imports.
vi.mock('../../../charges/charge-extended-info.js', () => ({
  ChargeExtendedInfo: () => null,
}));

vi.mock('../cells/accountant-approval.js', () => ({
  AccountantApproval: () => null,
}));

const EXPENSE_COUNT = 25;
const AMOUNT_PER_ROW = 100;
const VAT_PER_ROW = 17;

/**
 * `getFragmentData` is the identity function at runtime under the codegen client preset, so plain
 * fixture objects stand in for masked fragments.
 */
const expenses = Array.from({ length: EXPENSE_COUNT }, (_, index) => ({
  business: { id: `business-${index}`, name: `Business ${index}` },
  vatNumber: `1234${index}`,
  image: null,
  allocationNumber: null,
  documentSerial: `INV-${index}`,
  documentDate: '2026-01-01',
  chargeDate: '2026-01-01',
  chargeId: `charge-${index}`,
  amount: { formatted: '₪ 117', raw: 117 },
  localAmount: { formatted: '₪ 117', raw: 117 },
  localVat: { formatted: '₪ 17', raw: VAT_PER_ROW },
  foreignVatAfterDeduction: { formatted: '₪ 17', raw: VAT_PER_ROW },
  localVatAfterDeduction: { formatted: '₪ 17', raw: VAT_PER_ROW },
  roundedLocalVatAfterDeduction: { formatted: '₪ 17', raw: VAT_PER_ROW },
  taxReducedLocalAmount: { formatted: '₪ 100', raw: AMOUNT_PER_ROW },
  recordType: 'INVOICE',
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter>
        <ExpensesTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime-identity fragment masking
          data={{ expenses } as any}
          toggleMergeCharge={() => {}}
          mergeSelectedCharges={new Set()}
        />
      </MemoryRouter>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('VAT report expenses table', () => {
  it('renders every expense row', () => {
    // The reported bug: the shared feature set registered a paginated row model, so this table —
    // which renders no pagination control — showed only TanStack's default 10 rows.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(EXPENSE_COUNT);
  });

  it('carries the running totals through to the last row', () => {
    const rows = [...container.querySelectorAll('tbody tr')];
    const headers = [...container.querySelectorAll('thead th')].map(th => th.textContent?.trim());
    const cumulativeAmountIndex = headers.indexOf('Cumulative Amount without VAT ₪');
    const cumulativeVatIndex = headers.indexOf('Cumulative VAT');

    expect(cumulativeAmountIndex).toBeGreaterThanOrEqual(0);
    expect(cumulativeVatIndex).toBeGreaterThanOrEqual(0);

    // Why this table must not paginate: the cumulative columns are a running total over the whole
    // list, so the final row is only correct when every row before it is on screen.
    const lastRow = rows.at(-1)!.querySelectorAll('td');
    // The cells render through `formatStringifyAmount`, which groups thousands.
    const formatted = (value: number): string => value.toLocaleString('en-US');
    expect(lastRow[cumulativeAmountIndex]?.textContent).toContain(
      formatted(AMOUNT_PER_ROW * EXPENSE_COUNT),
    );
    expect(lastRow[cumulativeVatIndex]?.textContent).toContain(
      formatted(VAT_PER_ROW * EXPENSE_COUNT),
    );
  });
});
