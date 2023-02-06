// import { useMemo, useState } from 'react';
import {
  // ActionIcon,
  Table,
  // Tooltip
} from '@mantine/core';
// import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { VatMonthlyReportDocument } from '../../../gql/graphql';
// import { formatStringifyAmount } from '../../../helpers';
// import { useUrlQuery } from '../../../hooks/use-url-query';
import { AccounterLoader, Button, NavBar } from '../../common';
// import { TrialBalanceReportFilters } from './trial-balance-report-filters';
// import { TrialBalanceReportGroup } from './trial-balance-report-group';
// import { ExtendedSortCode } from './trial-balance-report-sort-code';

/* GraphQL */ `
  query VatMonthlyReport($filters: VatReportFilter) {
    vatReport(filters: $filters) {
      income {
        businessName
        vatNumber
        image
        documentSerial
        documentDate
        chargeDate
        amount {
          formatted
        }
        localAmount {
          formatted
        }
        vat {
          formatted
        }
        vatAfterDeduction {
          formatted
        }
        localVatAfterDeduction {
          formatted
        }
        roundedLocalVatAfterDeduction {
          formatted
        }
        taxReducedLocalAmount {
          formatted
        }
      }
      expenses {
        businessName
        vatNumber
        image
        documentSerial
        documentDate
        chargeDate
        amount {
          formatted
        }
        localAmount {
          formatted
        }
        vat {
          formatted
        }
        vatAfterDeduction {
          formatted
        }
        localVatAfterDeduction {
          formatted
        }
        roundedLocalVatAfterDeduction {
          formatted
        }
        taxReducedLocalAmount {
          formatted
        }
      }
    }
  }
`;

export const VatMonthlyReport = () => {
  // const [isAllOpened, setIsAllOpened] = useState(false);
  // const { get } = useUrlQuery();
  // const [{ isShowZeroedAccounts, ...filter }, setFilter] = useState<TrialBalanceReportFilters>(
  //   get('trialBalanceReportFilters')
  //     ? (JSON.parse(
  //         decodeURIComponent(get('trialBalanceReportFilters') as string),
  //       ) as TrialBalanceReportFilters)
  //     : {},
  // );
  const [{ data, fetching }] = useQuery({
    query: VatMonthlyReportDocument,
    variables: {
      // filters: filter,
      filters: {
        financialEntityId: '6a20aa69-57ff-446e-8d6a-1e96d095e988',
        fromDate: '2022-12-01',
        toDate: '2022-12-31',
      },
    },
  });

  // const businessTransactionsSum = useMemo(() => {
  //   return data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError'
  //     ? []
  //     : data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum ?? [];
  // }, [data?.businessTransactionsSumFromLedgerRecords]);

  // const sortCodes = useMemo(() => {
  //   return data?.allSortCodes ?? [];
  // }, [data?.allSortCodes]);

  // function roundNearest100(num: number) {
  //   return Math.floor(num / 100) * 100;
  // }

  // const extendedSortCodes = useMemo(() => {
  //   const adjustedSortCodes: Record<
  //     number,
  //     {
  //       sortCodes: Array<ExtendedSortCode>;
  //       credit: number;
  //       debit: number;
  //       sum: number;
  //     }
  //   > = {};

  //   sortCodes.map(sortCode => {
  //     if (!sortCode.accounts.length) return;

  //     const group = roundNearest100(sortCode.id);
  //     adjustedSortCodes[group] ??= {
  //       sortCodes: [],
  //       credit: 0,
  //       debit: 0,
  //       sum: 0,
  //     };

  //     const accounts = sortCode.accounts
  //       .map(account => {
  //         return {
  //           ...account,
  //           transactionsSum: businessTransactionsSum.find(s => s.businessName === account.key),
  //         };
  //       })
  //       .filter(
  //         account =>
  //           isShowZeroedAccounts ||
  //           (account.transactionsSum?.total.raw &&
  //             (account.transactionsSum.total.raw > 0.001 ||
  //               account.transactionsSum.total.raw < -0.001)),
  //       );

  //     const extendedSortCode = {
  //       ...sortCode,
  //       accounts,
  //       credit: accounts.reduce(
  //         (credit, account) =>
  //           credit +
  //           (account.transactionsSum?.total.raw && account.transactionsSum.total.raw > 0
  //             ? account.transactionsSum.total.raw
  //             : 0),
  //         0,
  //       ),
  //       debit:
  //         accounts.reduce(
  //           (debit, account) =>
  //             debit +
  //             (account.transactionsSum?.total.raw && account.transactionsSum.total.raw < 0
  //               ? account.transactionsSum.total.raw
  //               : 0),
  //           0,
  //         ) * -1,
  //       sum: accounts.reduce(
  //         (total, account) =>
  //           total + (account.transactionsSum?.total.raw ? account.transactionsSum.total.raw : 0),
  //         0,
  //       ),
  //     };
  //     adjustedSortCodes[group]['sortCodes'].push(extendedSortCode);
  //     adjustedSortCodes[group].sum += extendedSortCode.sum;
  //   });

  //   return adjustedSortCodes;
  // }, [sortCodes, businessTransactionsSum, isShowZeroedAccounts]);

  return (
    <div className="text-gray-600 body-font">
      <div className="container md:px-5 px-2 md:py-12 py-2 mx-auto">
        <NavBar
          header="Vat Monthly Report"
          filters={
            <div className="flex flex-row gap-2">
              {/* <Tooltip label="Expand all accounts">
                <ActionIcon variant="default" onClick={() => setIsAllOpened(i => !i)} size={30}>
                  {isAllOpened ? (
                    <LayoutNavbarCollapse size={20} />
                  ) : (
                    <LayoutNavbarExpand size={20} />
                  )}
                </ActionIcon>
              </Tooltip> */}
              {/* <TrialBalanceReportFilters
                filter={{ ...filter, isShowZeroedAccounts }}
                setFilter={setFilter}
              /> */}
            </div>
          }
        />
        {fetching ? (
          <AccounterLoader />
        ) : (
          <div className="flex flex-col gap-4">
            <span className="self-center text-lg font-semibold whitespace-nowrap">Income</span>
            <Table highlightOnHover>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr className="bg-gray-300">
                  <th>Business</th>
                  <th>Invoice</th>
                  <th>Invoice Serial#</th>
                  <th>Invoice Date</th>
                  <th>Transaction Date</th>
                  <th>Amount</th>
                  <th>Amount &#8362;</th>
                  <th>VAT</th>
                  <th>VAT &#8362;</th>
                  <th>Actual VAT</th>
                  <th>Rounded VAT</th>
                  <th>Cumulative VAT</th>
                  <th>Amount without VAT &#8362;</th>
                  <th>Cumulative Amount without VAT &#8362;</th>
                </tr>
              </thead>
              <tbody>
                {data?.vatReport?.income?.map((item, index) => (
                  <tr className="bg-gray-100" key={index}>
                    <td>
                      {item.businessName}-{item.vatNumber}
                    </td>
                    <td>
                      {item.image && (
                        <a href={item.image} target="_blank" rel="noreferrer">
                          <img alt="missing img" src={item.image} height={80} width={80} />
                        </a>
                      )}
                    </td>
                    <td>{item.documentSerial}</td>
                    <td>{item.documentDate}</td>
                    <td>{item.chargeDate}</td>
                    <td>{item.amount.formatted}</td>
                    <td>{item.localAmount?.formatted}</td>
                    <td>{item.vat?.formatted}</td>
                    <td>{item.localVatAfterDeduction?.formatted}</td>
                    <td>{item.vatAfterDeduction?.formatted}</td>
                    <td>{item.roundedLocalVatAfterDeduction?.formatted}</td>
                    <td>Not yet</td>
                    <td>{item.taxReducedLocalAmount?.formatted}</td>
                    <td>Not yet</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <span className="self-center text-lg font-semibold whitespace-nowrap">Expenses</span>
            <Table highlightOnHover>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr className="bg-gray-300">
                  <th>Business</th>
                  <th>Invoice</th>
                  <th>Invoice Serial#</th>
                  <th>Invoice Date</th>
                  <th>Transaction Date</th>
                  <th>Amount</th>
                  <th>Amount &#8362;</th>
                  <th>VAT</th>
                  <th>VAT &#8362;</th>
                  <th>Actual VAT</th>
                  <th>Rounded VAT</th>
                  <th>Cumulative VAT</th>
                  <th>Amount without VAT &#8362;</th>
                  <th>Cumulative Amount without VAT &#8362;</th>
                </tr>
              </thead>
              <tbody>
                {data?.vatReport?.expenses?.map((item, index) => (
                  <tr className="bg-gray-100" key={index}>
                    <td>
                      {item.businessName}-{item.vatNumber}
                    </td>
                    <td>
                      {item.image && (
                        <a href={item.image} target="_blank" rel="noreferrer">
                          <img alt="missing img" src={item.image} height={80} width={80} />
                        </a>
                      )}
                    </td>
                    <td>{item.documentSerial}</td>
                    <td>{item.documentDate}</td>
                    <td>{item.chargeDate}</td>
                    <td>{item.amount.formatted}</td>
                    <td>{item.localAmount?.formatted}</td>
                    <td>{item.vat?.formatted}</td>
                    <td>{item.localVatAfterDeduction?.formatted}</td>
                    <td>{item.vatAfterDeduction?.formatted}</td>
                    <td>{item.roundedLocalVatAfterDeduction?.formatted}</td>
                    <td>Not yet</td>
                    <td>{item.taxReducedLocalAmount?.formatted}</td>
                    <td>Not yet</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
