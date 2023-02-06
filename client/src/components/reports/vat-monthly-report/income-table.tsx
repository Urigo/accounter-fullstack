import { useState } from 'react';
import { ActionIcon, Table } from '@mantine/core';
import { CaretDown, CaretUp } from 'tabler-icons-react';
import { FragmentType, getFragmentData } from '../../../gql';
import { VarReportIncomeFieldsFragmentDoc } from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';

/* GraphQL */ `
  fragment VarReportIncomeFields on VatReportResult {
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
        raw
        }
    }
}
`;

interface Props {
  data?: FragmentType<typeof VarReportIncomeFieldsFragmentDoc>;
}

export const IncomeTable = ({ data }: Props) => {
  const { income } = getFragmentData(VarReportIncomeFieldsFragmentDoc, data) ?? { income: [] };
  const [isOpened, setOpened] = useState(true);
  let incomeCumulativeAmount = 0;

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={() => setOpened(i => !i)} size={30}>
          {isOpened ? <CaretUp size={20} /> : <CaretDown size={20} />}
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
            </tr>
          </thead>
          <tbody>
            {income.map((item, index) => {
              incomeCumulativeAmount += item.taxReducedLocalAmount?.raw ?? 0;
              const cumulativeAmount = incomeCumulativeAmount;
              return (
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
