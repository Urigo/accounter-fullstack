import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReportSummary } from '../report-summary.js';

const ils = (raw: number) => ({ raw, currency: 'ILS' });

/**
 * A server `summary` for a month, i.e. the totals in that month's PCN874 header. `getFragmentData`
 * is the identity function at runtime under the codegen client preset, so plain fixture objects
 * stand in for masked fragments.
 */
const summary = {
  taxableSalesAmount: ils(12_500),
  taxableSalesVat: ils(2125),
  salesRecordCount: 4,
  zeroValOrExemptSalesAmount: ils(3000),
  otherInputsVat: ils(340),
  equipmentInputsVat: ils(510),
  inputsCount: 3,
  totalVat: ils(1275),
};

let container: HTMLDivElement;
let root: Root;

const render = (data: unknown) => {
  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime-identity fragment masking
    root.render(<ReportSummary data={data as any} />);
  });
};

/** Label → displayed value, for every figure on the card. */
const figures = () =>
  Object.fromEntries(
    [...container.querySelectorAll('.grid > div')].map(figure => {
      const [label, value] = [...figure.querySelectorAll('p')].map(p => p.textContent?.trim());
      return [label, value];
    }),
  );

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('VAT report summary card', () => {
  it('shows every PCN874 header total under its PCN874 meaning', () => {
    render({ summary });

    expect(figures()).toEqual({
      'Taxable Sales Amount': '₪ 12,500.00',
      'Taxable Sales VAT': '₪ 2,125.00',
      'Zero / Exempt Sales': '₪ 3,000.00',
      'Sales Records': '4',
      'Other Inputs VAT': '₪ 340.00',
      'Equipment Inputs VAT': '₪ 510.00',
      'Input Records': '3',
      'Total VAT': '₪ 1,275.00',
    });
  });

  it('shows the server totals as they are, without recomputing them from the report rows', () => {
    // Rows the card used to reduce on its own: under that definition taxable sales would include
    // the zero-VAT row (₪ 1,500) and equipment inputs would be a pre-VAT amount (₪ 3,000). The
    // card must ignore them and show only what the server says is filed.
    render({
      summary,
      income: [
        { taxReducedLocalAmount: { raw: 1000 }, roundedLocalVatAfterDeduction: { raw: 170 } },
        { taxReducedLocalAmount: { raw: 500 }, roundedLocalVatAfterDeduction: { raw: 0 } },
      ],
      expenses: [
        {
          taxReducedLocalAmount: { raw: 3000 },
          roundedLocalVatAfterDeduction: { raw: 510 },
          isProperty: true,
        },
      ],
    });

    const shown = figures();
    expect(shown['Taxable Sales Amount']).toBe('₪ 12,500.00');
    expect(shown['Equipment Inputs VAT']).toBe('₪ 510.00');
    expect(shown['Total VAT']).toBe('₪ 1,275.00');
  });

  it('keeps the currency the server reports the totals in', () => {
    const usd = (raw: number) => ({ raw, currency: 'USD' });
    render({
      summary: {
        ...summary,
        taxableSalesAmount: usd(100),
        totalVat: usd(17),
      },
    });

    expect(figures()['Taxable Sales Amount']).toBe('$ 100.00');
    expect(figures()['Total VAT']).toBe('$ 17.00');
  });

  it('says whether the total VAT is to pay or to receive', () => {
    render({ summary });
    expect(container.textContent).toContain('to pay');
    expect(container.textContent).not.toContain('to receive');

    render({ summary: { ...summary, totalVat: ils(-476) } });
    expect(figures()['Total VAT']).toBe('₪ -476.00');
    expect(container.textContent).toContain('to receive');
    expect(container.textContent).not.toContain('to pay');
  });

  it('says neither for a zero VAT balance', () => {
    render({ summary: { ...summary, totalVat: ils(0) } });

    expect(figures()['Total VAT']).toBe('₪ 0.00');
    expect(container.textContent).not.toContain('to pay');
    expect(container.textContent).not.toContain('to receive');
  });

  it('renders nothing until the report has loaded', () => {
    render(undefined);
    expect(container.innerHTML).toBe('');
  });
});
