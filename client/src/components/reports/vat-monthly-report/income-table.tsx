import { ReactElement, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Table } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { VarReportIncomeFieldsFragmentDoc } from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VarReportIncomeFields on VatReportResult {
    income {
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

export const IncomeTable = ({ data }: Props): ReactElement => {
  const { income } = getFragmentData(VarReportIncomeFieldsFragmentDoc, data) ?? { income: [] };
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
            </tr>
          </thead>
          <tbody>
            {income.map((item, index) => {
              incomeCumulativeAmount += item.taxReducedLocalAmount?.raw ?? 0;
              const cumulativeAmount = incomeCumulativeAmount;
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
                  <td>{item.amount.formatted}</td>
                  <td>{item.taxReducedLocalAmount?.formatted}</td>
                  <td>{'₪ ' + formatStringifyAmount(cumulativeAmount, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
};
