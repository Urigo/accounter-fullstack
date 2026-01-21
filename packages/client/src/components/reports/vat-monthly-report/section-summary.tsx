import { useMemo, type ReactElement } from 'react';
import { formatAmountWithCurrency } from '@/helpers/currency.js';
import { Currency, type Pcn874RecordType } from '../../../gql/graphql.js';
import { getRecordTypeName } from './utils.js';

type RecordType = {
  recordType: Pcn874RecordType;
  roundedLocalVatAfterDeduction?: { raw: number } | null;
  taxReducedLocalAmount?: { raw: number } | null;
};

export const calculateSummary = (documents: RecordType[]) => {
  const grouped = documents.reduce(
    (acc, doc) => {
      acc[doc.recordType] ||= {
        recordType: doc.recordType,
        count: 0,
        vatTotal: 0,
        totalBeforeVat: 0,
      };
      acc[doc.recordType].count++;
      acc[doc.recordType].vatTotal += doc.roundedLocalVatAfterDeduction?.raw ?? 0;
      acc[doc.recordType].totalBeforeVat += doc.taxReducedLocalAmount?.raw ?? 0;
      return acc;
    },
    {} as Record<
      Pcn874RecordType,
      {
        recordType: Pcn874RecordType;
        count: number;
        vatTotal: number;
        totalBeforeVat: number;
      }
    >,
  );

  return Object.values(grouped);
};

interface Props {
  records: RecordType[];
}

export const SectionSummary = ({ records }: Props): ReactElement => {
  const recordsSummary = useMemo(() => calculateSummary(records ?? []), [records]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 text-sm font-medium text-muted-foreground">Record Type</th>
            <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Count</th>
            <th className="pb-3 text-sm font-medium text-muted-foreground text-right">
              Total Before VAT
            </th>
            <th className="pb-3 text-sm font-medium text-muted-foreground text-right">VAT Total</th>
          </tr>
        </thead>
        <tbody>
          {recordsSummary.map(row => (
            <tr key={row.recordType} className="border-b border-border/50">
              <td className="py-3 text-sm font-medium">
                {getRecordTypeName(row.recordType)} ({row.recordType})
              </td>
              <td className="py-3 text-sm text-right">{row.count}</td>
              <td className="py-3 text-sm text-right">
                {formatAmountWithCurrency(row.totalBeforeVat, Currency.Ils)}
              </td>
              <td className="py-3 text-sm text-right">
                {formatAmountWithCurrency(row.vatTotal, Currency.Ils)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
