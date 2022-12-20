import { BusinessTransactionsFilter, TrialBalanceReportQuery } from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';
import { ExtendedAccount } from './trial-balance-report-account';
import { TrialBalanceReportSortCode } from './trial-balance-report-sort-code';

export type ExtendedSortCode = Omit<TrialBalanceReportQuery['allSortCodes'][number], 'accounts'> & {
  accounts: Array<ExtendedAccount>;
  credit: number;
  debit: number;
  sum: number;
};

interface Props {
  data: {
    sortCodes: Array<ExtendedSortCode>;
    credit: number;
    debit: number;
    sum: number;
  };
  group: string;
  filter: BusinessTransactionsFilter;
}

export const TrialBalanceReportGroup = ({ group, data, filter }: Props) => {
  return (
    <>
      {data.sortCodes.map((sortCode, i) => (
        <TrialBalanceReportSortCode
          key={`${sortCode.id} ${i}`}
          sortCode={sortCode}
          filter={filter}
        />
      ))}
      <tr key={'group' + group} className="bg-gray-100">
        <td colSpan={2}>Group total:</td>
        <td colSpan={1}>{group.replaceAll('0', '*')}</td>
        <td colSpan={1}>{}</td>
        <td colSpan={1}>{}</td>
        <td colSpan={1}>{formatStringifyAmount(data.sum)}</td>
      </tr>
    </>
  );
};
