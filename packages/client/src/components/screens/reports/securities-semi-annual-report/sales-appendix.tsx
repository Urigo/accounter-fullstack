import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  SecuritiesSemiAnnualSalesFragmentDoc,
  SecurityTradeType,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { ROUTES } from '../../../../router/routes.js';
import { Amount, BilingualLabel, SectionHeading } from './declaration-line.js';
import { formatShekels, formatShortDate } from './helpers.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SecuritiesSemiAnnualSales on SecuritiesSemiAnnualReport {
    id
    sales {
      id
      securityBusinessId
      tradeDate
      tradeType
      security
      quantity
      consideration {
        raw
      }
      cost {
        raw
      }
      inflationaryAmount {
        raw
      }
      realGain {
        raw
      }
      israeliTaxWithheld {
        raw
      }
      error
    }
  }
`;

const COLUMNS: { he: string; en: string; numeric?: boolean }[] = [
  { he: 'תאריך', en: 'Date' },
  { he: 'נייר ערך', en: 'Security' },
  { he: 'כמות', en: 'Units', numeric: true },
  { he: 'תמורה', en: 'Consideration', numeric: true },
  { he: 'עלות', en: 'Cost', numeric: true },
  { he: 'סכום אינפלציוני', en: 'Inflationary', numeric: true },
  { he: 'רווח (הפסד) ריאלי', en: 'Real gain (loss)', numeric: true },
  { he: 'מס שנוכה', en: 'Tax withheld', numeric: true },
];

const optional = (amount?: { raw: number } | null) => (amount ? formatShekels(amount.raw) : '—');

type Props = {
  data: FragmentType<typeof SecuritiesSemiAnnualSalesFragmentDoc>;
};

/** Appendix A: every sale and redemption of the half, with how its gain was worked out */
export function SalesAppendix({ data }: Props): ReactElement {
  const { sales } = getFragmentData(SecuritiesSemiAnnualSalesFragmentDoc, data);

  return (
    <section
      dir="rtl"
      lang="he"
      className="mx-auto w-full max-w-[210mm] rounded-xl border border-gray-200 bg-white p-10 text-gray-900 shadow-sm print:max-w-none print:break-before-page print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <SectionHeading
        he="נספח א׳ – פירוט מכירות ופדיונות"
        en="Appendix A – sales and redemptions"
      />
      {sales.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">לא היו מכירות בתקופה · No sales in the period</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="table-header-group">
            <tr className="border-b border-gray-300 text-gray-600">
              {COLUMNS.map(column => (
                <th
                  key={column.en}
                  className={`px-1 py-2 align-bottom font-medium ${column.numeric ? 'text-end' : 'text-start'}`}
                >
                  <BilingualLabel
                    he={column.he}
                    en={column.en}
                    align={column.numeric ? 'end' : 'start'}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sales.map(sale => (
              <tr key={sale.id} className="break-inside-avoid border-b border-gray-100 align-top">
                <td className="px-1 py-1.5">
                  <Amount>{formatShortDate(sale.tradeDate)}</Amount>
                </td>
                <td className="px-1 py-1.5">
                  <div dir="ltr" className="text-right">
                    {sale.securityBusinessId ? (
                      <Link
                        to={ROUTES.BUSINESSES.DETAIL(sale.securityBusinessId)}
                        className="hover:underline print:no-underline"
                      >
                        {sale.security}
                      </Link>
                    ) : (
                      sale.security
                    )}
                    {sale.tradeType === SecurityTradeType.Redemption && (
                      <span className="ms-1 text-gray-500">(פדיון)</span>
                    )}
                  </div>
                  {sale.error && (
                    <div dir="ltr" className="text-right text-amber-700">
                      ⚠ {sale.error}
                    </div>
                  )}
                </td>
                <td className="px-1 py-1.5 text-end">
                  <Amount>{sale.quantity.toLocaleString('en-US')}</Amount>
                </td>
                <td className="px-1 py-1.5 text-end">
                  <Amount>{formatShekels(sale.consideration.raw)}</Amount>
                </td>
                <td className="px-1 py-1.5 text-end">
                  <Amount>{optional(sale.cost)}</Amount>
                </td>
                <td className="px-1 py-1.5 text-end">
                  <Amount>{optional(sale.inflationaryAmount)}</Amount>
                </td>
                <td className="px-1 py-1.5 text-end font-medium">
                  <Amount>{optional(sale.realGain)}</Amount>
                </td>
                <td className="px-1 py-1.5 text-end">
                  <Amount>{formatShekels(sale.israeliTaxWithheld.raw)}</Amount>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-gray-500">
        התמורה והעלות בשקלים לפי השער היציג של בנק ישראל ביום העסקה; העלות לפי FIFO.
      </p>
    </section>
  );
}
