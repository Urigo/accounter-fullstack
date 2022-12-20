import { TrialBalanceReportQuery } from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';
import { ExtendedAccount, TrialBalanceReportAccount } from './trial-balance-report-account';
import { TrialBalanceReportFilters } from './trial-balance-report-filters';

export type ExtendedSortCode = Omit<TrialBalanceReportQuery['allSortCodes'][number], 'accounts'> & {
  accounts: Array<ExtendedAccount>;
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
  return sortCode.accounts.length > 0 ? (
    <>
      <tr>
        <td colSpan={7}>
          <span className="font-bold">{sortCode.name}</span>
        </td>
      </tr>
      {sortCode.accounts.map(account => (
        <TrialBalanceReportAccount
          key={account.id}
          account={account}
          sortCodeId={sortCode.id}
          filter={filter}
          isAllOpened={isAllOpened}
        />
      ))}

      <tr className="bg-gray-100">
        {sortCode.accounts.length > 1 ? (
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
