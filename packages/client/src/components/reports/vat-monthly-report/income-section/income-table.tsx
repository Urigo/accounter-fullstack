import { ReactElement, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Table } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
import { IncomeRow, VatReportIncomeRowFieldsFragmentDoc } from './income-row.js';

export const VatReportIncomeFieldsFragmentDoc = graphql(
  `
    fragment VatReportIncomeFields on VatReportResult {
      income {
        ...VatReportIncomeRowFields
        taxReducedLocalAmount {
          raw
        }
      }
    }
  `,
  [VatReportIncomeRowFieldsFragmentDoc],
);

interface Props {
  data?: FragmentOf<typeof VatReportIncomeFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: string[];
}

export const IncomeTable = ({
  data,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const { income } = readFragment(VatReportIncomeFieldsFragmentDoc, data) ?? { income: [] };
  const [isOpened, setIsOpened] = useState(true);
  let incomeCumulativeAmount = 0;

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={(): void => setIsOpened(i => !i)} size={30}>
          {isOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
        </ActionIcon>
        Income
      </span>
      {isOpened && (
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
              <th>Cumulative Amount &#8362;</th>
              <th>Accountant Approval</th>
              <th colSpan={2}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {income.map((item, index) => {
              incomeCumulativeAmount += item.taxReducedLocalAmount?.raw ?? 0;
              const cumulativeAmount = incomeCumulativeAmount;
              return (
                <IncomeRow
                  key={index}
                  data={item}
                  toggleMergeCharge={toggleMergeCharge}
                  mergeSelectedCharges={mergeSelectedCharges}
                  cumulativeAmount={cumulativeAmount}
                />
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
};
