import { formatStringifyAmount } from '../../../helpers';
import { ExtendedBusiness, TrialBalanceReportBusiness } from './trial-balance-report-account';
import { TrialBalanceReportFilters } from './trial-balance-report-filters';

export type ExtendedSortCode = {
  id: number;
  name?: string | null;
  records: Array<ExtendedBusiness>;
  credit: number;
  debit: number;
  sum: number;
};

interface Props {
  sortCode: ExtendedSortCode;
  filter: TrialBalanceReportFilters;
  isAllOpened: boolean;
}

export const TrialBalanceReportSortCode = ({ sortCode, filter, isAllOpened }: Props) => {
  return sortCode.records.length > 0 ? (
    <>
      <tr>
        <td colSpan={7}>
          <span className="font-bold">{sortCode.name}</span>
        </td>
      </tr>
      {sortCode.records.map(record => (
        <TrialBalanceReportBusiness
          key={record.business.id}
          record={record}
          sortCodeId={sortCode.id}
          filter={filter}
          isAllOpened={isAllOpened}
        />
      ))}

      <tr className="bg-gray-100">
        {sortCode.records.length > 1 ? (
          <>
            <td colSpan={2}>Group total:</td>
            <td colSpan={1}>{sortCode.id}</td>
            <td colSpan={1}>{formatStringifyAmount(sortCode.debit)}</td>
            <td colSpan={1}>{formatStringifyAmount(sortCode.credit)}</td>
            <td colSpan={1}>{formatStringifyAmount(sortCode.sum)}</td>
          </>
        ) : undefined}
      </tr>
    </>
  ) : null;
};
