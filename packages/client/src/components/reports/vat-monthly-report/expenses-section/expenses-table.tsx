import { useState, type ReactElement } from 'react';
import { PanelTopClose, PanelTopOpen } from 'lucide-react';
import { Table } from '@mantine/core';
import { VatReportExpensesFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { Button } from '../../../ui/button.js';
import { ExpensesRow } from './expenses-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
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
`;

interface Props {
  data?: FragmentType<typeof VatReportExpensesFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: string[];
}

export const ExpensesTable = ({
  data,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const { expenses } = getFragmentData(VatReportExpensesFieldsFragmentDoc, data) ?? {
    expenses: [],
  };
  const [isOpened, setIsOpened] = useState(true);
  let expensesCumulativeAmount = 0;
  let expensesCumulativeVat = 0;

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(): void => setIsOpened(i => !i)}
        >
          {isOpened ? <PanelTopClose className="size-5" /> : <PanelTopOpen className="size-5" />}
        </Button>
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
