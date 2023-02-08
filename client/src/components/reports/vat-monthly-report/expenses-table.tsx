import { useState } from 'react';
import { ActionIcon, Table } from '@mantine/core';
import { CaretDown, CaretUp } from 'tabler-icons-react';
import { FragmentType, getFragmentData } from '../../../gql';
import { VarReportExpensesFieldsFragmentDoc } from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';

/* GraphQL */ `
  fragment VarReportExpensesFields on VatReportResult {
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

export const ExpensesTable = ({ data }: Props) => {
  const { expenses } = getFragmentData(VarReportExpensesFieldsFragmentDoc, data) ?? {
    expenses: [],
  };
  const [isOpened, setOpened] = useState(true);
  let expensesCumulativeAmount = 0;
  let expensesCumulativeVat = 0;

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={() => setOpened(i => !i)} size={30}>
          {isOpened ? <CaretUp size={20} /> : <CaretDown size={20} />}
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
                    {item.businessName}
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
                  <td>{item.amount.formatted}</td>
                  <td>{item.localAmount?.formatted}</td>
                  <td>{item.vat?.formatted}</td>
                  <td>{item.localVatAfterDeduction?.formatted}</td>
                  <td>{item.vatAfterDeduction?.formatted}</td>
                  <td>{item.roundedLocalVatAfterDeduction?.formatted}</td>
                  <td>{formatStringifyAmount(cumulativeVat)} ILS</td>
                  <td>{item.taxReducedLocalAmount?.formatted}</td>
                  <td>{formatStringifyAmount(cumulativeAmount)} ILS</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
};
