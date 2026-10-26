import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  SecuritiesIncomeKind,
  SecuritiesSemiAnnualIncomeFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { ROUTES } from '../../../../router/routes.js';
import { Amount, BilingualLabel, SectionHeading } from './declaration-line.js';
import {
  formatShekels,
  formatShortDate,
  INCOME_KIND_LABELS,
  INCOME_LOCALITY_LABELS,
} from './helpers.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SecuritiesSemiAnnualIncome on SecuritiesSemiAnnualReport {
    id
    incomeItems {
      id
      kind
      locality
      chargeId
      date
      security
      description
      gross {
        raw
      }
      foreignTaxWithheld {
        raw
      }
      israeliTaxWithheld {
        raw
      }
    }
  }
`;

const COLUMNS: { he: string; en: string; numeric?: boolean }[] = [
  { he: 'תאריך', en: 'Date' },
  { he: 'נייר ערך', en: 'Security' },
  { he: 'מקומי / זר', en: 'Locality' },
  { he: 'ברוטו', en: 'Gross', numeric: true },
  { he: 'מס זר', en: 'Foreign tax', numeric: true },
  { he: 'מס שנוכה בישראל', en: 'Israeli tax', numeric: true },
];

type Props = {
  data: FragmentType<typeof SecuritiesSemiAnnualIncomeFragmentDoc>;
};

/** Appendix B: the half's dividend and interest ledger records, by kind */
export function IncomeAppendix({ data }: Props): ReactElement {
  const { incomeItems } = getFragmentData(SecuritiesSemiAnnualIncomeFragmentDoc, data);

  return (
    <section
      dir="rtl"
      lang="he"
      className="mx-auto w-full max-w-[210mm] rounded-xl border border-gray-200 bg-white p-10 text-gray-900 shadow-sm print:max-w-none print:break-before-page print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <SectionHeading
        he="נספח ב׳ – פירוט הכנסות מדיבידנד ומריבית"
        en="Appendix B – dividend and interest income"
      />
      {[SecuritiesIncomeKind.Dividend, SecuritiesIncomeKind.Interest].map(kind => {
        const items = incomeItems.filter(item => item.kind === kind);
        return (
          <div key={kind} className="mb-6">
            <h4 className="mb-1 mt-4 text-sm font-semibold">
              <BilingualLabel he={INCOME_KIND_LABELS[kind].he} en={INCOME_KIND_LABELS[kind].en} />
            </h4>
            {items.length === 0 ? (
              <p className="py-2 text-xs text-gray-500">אין · None</p>
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
                  {items.map(item => (
                    <tr
                      key={item.id}
                      className="break-inside-avoid border-b border-gray-100 align-top"
                    >
                      <td className="px-1 py-1.5">
                        <Link
                          to={ROUTES.CHARGES.DETAIL(item.chargeId)}
                          className="hover:underline print:no-underline"
                        >
                          <Amount>{formatShortDate(item.date)}</Amount>
                        </Link>
                      </td>
                      <td className="px-1 py-1.5">
                        <div dir="ltr" className="text-right">
                          {item.security ?? item.description ?? '—'}
                        </div>
                      </td>
                      <td className="px-1 py-1.5">{INCOME_LOCALITY_LABELS[item.locality].he}</td>
                      <td className="px-1 py-1.5 text-end font-medium">
                        <Amount>{formatShekels(item.gross.raw)}</Amount>
                      </td>
                      <td className="px-1 py-1.5 text-end">
                        <Amount>{formatShekels(item.foreignTaxWithheld.raw)}</Amount>
                      </td>
                      <td className="px-1 py-1.5 text-end">
                        <Amount>{formatShekels(item.israeliTaxWithheld.raw)}</Amount>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      <p className="text-xs text-gray-500">
        לפי רישומי הספרים בקטגוריות המס של הכנסות מניירות ערך, לפי תאריך הרישום. סכום שלילי הוא
        ביטול.
      </p>
    </section>
  );
}
