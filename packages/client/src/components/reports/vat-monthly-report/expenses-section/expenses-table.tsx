import { ReactElement, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Table } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
import { ExpensesRow, VatReportExpensesRowFieldsFragmentDoc } from './expenses-row.js';

export const VatReportExpensesFieldsFragmentDoc = graphql(
  `
    fragment VatReportExpensesFields on VatReportResult {
      expenses {
        ...VatReportExpensesRowFields
        roundedLocalVatAfterDeduction {
          raw
        }
        taxReducedLocalAmount {
          raw
        }
      }
    }
  `,
  [VatReportExpensesRowFieldsFragmentDoc],
);

interface Props {
  data?: FragmentOf<typeof VatReportExpensesFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: string[];
}

export const ExpensesTable = ({
  data,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const { expenses } = readFragment(VatReportExpensesFieldsFragmentDoc, data) ?? {
    expenses: [],
  };
  const [isOpened, setIsOpened] = useState(true);
  let expensesCumulativeAmount = 0;
  let expensesCumulativeVat = 0;

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={(): void => setIsOpened(i => !i)} size={30}>
          {isOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
        </ActionIcon>
        Expenses
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
              <th>VAT</th>
              <th>VAT &#8362;</th>
              <th>Actual VAT</th>
              <th>Rounded VAT</th>
              <th>Cumulative VAT</th>
              <th>Amount without VAT &#8362;</th>
              <th>Cumulative Amount without VAT &#8362;</th>
              <th>Accountant Approval</th>
              <th colSpan={2}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((item, index) => {
              expensesCumulativeAmount += item.taxReducedLocalAmount?.raw ?? 0;
              const cumulativeAmount = expensesCumulativeAmount;
              expensesCumulativeVat += item.roundedLocalVatAfterDeduction?.raw ?? 0;
              const cumulativeVat = expensesCumulativeVat;
              return (
                <ExpensesRow
                  key={index}
                  data={item}
                  toggleMergeCharge={toggleMergeCharge}
                  mergeSelectedCharges={mergeSelectedCharges}
                  cumulativeVat={cumulativeVat}
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
