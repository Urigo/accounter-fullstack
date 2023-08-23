import { ReactElement, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Table } from '@mantine/core';
import { VarReportExpensesFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { formatStringifyAmount } from '../../../helpers';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VarReportExpensesFields on VatReportResult {
    expenses {
        business {
          id
          name
        }
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
          raw
        }
        taxReducedLocalAmount {
          formatted
          raw
        }
      }
}
`;

interface Props {
  data?: FragmentType<typeof VarReportExpensesFieldsFragmentDoc>;
}

export const ExpensesTable = ({ data }: Props): ReactElement => {
  const { expenses } = getFragmentData(VarReportExpensesFieldsFragmentDoc, data) ?? {
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
            </tr>
          </thead>
          <tbody>
            {expenses.map((item, index) => {
              expensesCumulativeAmount += item.taxReducedLocalAmount?.raw ?? 0;
              const cumulativeAmount = expensesCumulativeAmount;
              expensesCumulativeVat += item.roundedLocalVatAfterDeduction?.raw ?? 0;
              const cumulativeVat = expensesCumulativeVat;
              return (
                <tr className="bg-gray-100" key={index}>
                  <td className="flex flex-col gap-1">
                    {item.business?.name}
                    {item.vatNumber && (
                      <span style={{ fontSize: '10px', color: 'darkGray' }}>{item.vatNumber}</span>
                    )}
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
                  <td className="whitespace-nowrap">{item.amount.formatted}</td>
                  <td className="whitespace-nowrap">{item.localAmount?.formatted}</td>
                  <td className="whitespace-nowrap">{item.vat?.formatted}</td>
                  <td className="whitespace-nowrap">{item.localVatAfterDeduction?.formatted}</td>
                  <td className="whitespace-nowrap">{item.vatAfterDeduction?.formatted}</td>
                  <td className="whitespace-nowrap">
                    {item.roundedLocalVatAfterDeduction?.formatted}
                  </td>
                  <td className="whitespace-nowrap">
                    &#8362; {formatStringifyAmount(cumulativeVat, 0)}
                  </td>
                  <td className="whitespace-nowrap">{item.taxReducedLocalAmount?.formatted}</td>
                  <td className="whitespace-nowrap">
                    &#8362; {formatStringifyAmount(cumulativeAmount, 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
};
