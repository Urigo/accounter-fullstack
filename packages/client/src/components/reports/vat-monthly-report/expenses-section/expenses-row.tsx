import { ReactElement, useState } from 'react';
import { Paper } from '@mantine/core';
import { VatReportExpensesRowFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';
import { ChargeExtendedInfo } from '../../../all-charges/charge-extended-info.js';
import { ToggleExpansionButton, ToggleMergeSelected } from '../../../common/index.js';
import { AccountantApproval } from '../cells/accountant-approval.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportExpensesRowFields on VatReportRecord {
    ...VatReportAccountantApprovalFields
    business {
      id
      name
    }
    vatNumber
    image
    documentSerial
    documentDate
    chargeDate
    chargeId
    # chargeAccountantReviewed
    amount {
      formatted
    }
    localAmount {
      formatted
    }
    localVat {
      formatted
    }
    foreignVatAfterDeduction {
      formatted
    }
    localVatAfterDeduction {
      formatted
    }
    roundedLocalVatAfterDeduction {
      formatted
      #   raw
    }
    taxReducedLocalAmount {
      formatted
      #   raw
    }
  }
`;

interface Props {
  data: FragmentType<typeof VatReportExpensesRowFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: string[];
  cumulativeVat: number;
  cumulativeAmount: number;
}

export const ExpensesRow = ({
  data,
  toggleMergeCharge,
  mergeSelectedCharges,
  cumulativeVat,
  cumulativeAmount,
}: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const expenseItem = getFragmentData(VatReportExpensesRowFieldsFragmentDoc, data);

  return (
    <>
      <tr className="bg-gray-100">
        <td className="flex flex-col gap-1">
          {expenseItem.business?.name}
          {expenseItem.vatNumber && (
            <span style={{ fontSize: '10px', color: 'darkGray' }}>{expenseItem.vatNumber}</span>
          )}
        </td>
        <td>
          {expenseItem.image && (
            <a href={expenseItem.image} target="_blank" rel="noreferrer">
              <img alt="missing img" src={expenseItem.image} height={80} width={80} />
            </a>
          )}
        </td>
        <td>{expenseItem.documentSerial}</td>
        <td>{expenseItem.documentDate}</td>
        <td>{expenseItem.chargeDate}</td>
        <td className="whitespace-nowrap">{expenseItem.amount.formatted}</td>
        <td className="whitespace-nowrap">{expenseItem.localAmount?.formatted}</td>
        <td className="whitespace-nowrap">{expenseItem.localVat?.formatted}</td>
        <td className="whitespace-nowrap">{expenseItem.localVatAfterDeduction?.formatted}</td>
        <td className="whitespace-nowrap">{expenseItem.foreignVatAfterDeduction?.formatted}</td>
        <td className="whitespace-nowrap">
          {expenseItem.roundedLocalVatAfterDeduction?.formatted}
        </td>
        <td className="whitespace-nowrap">&#8362; {formatStringifyAmount(cumulativeVat, 0)}</td>
        <td className="whitespace-nowrap">&#8362; {formatStringifyAmount(cumulativeAmount, 0)}</td>
        <AccountantApproval data={expenseItem} />
        <td>
          <div className="flex flex-col gap-2">
            <ToggleExpansionButton toggleExpansion={setOpened} isExpanded={opened} />
          </div>
        </td>
        <td>
          <ToggleMergeSelected
            toggleMergeSelected={(): void => toggleMergeCharge(expenseItem.chargeId)}
            mergeSelected={mergeSelectedCharges.includes(expenseItem.chargeId)}
          />
        </td>
      </tr>
      {opened && (
        <tr>
          <td colSpan={17}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              <ChargeExtendedInfo chargeID={expenseItem.chargeId} />
            </Paper>
          </td>
        </tr>
      )}
    </>
  );
};
