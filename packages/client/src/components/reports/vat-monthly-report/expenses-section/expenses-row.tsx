import { ReactElement, useState } from 'react';
import { Paper } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';
import { ChargeExtendedInfo } from '../../../all-charges/charge-extended-info.js';
import { ToggleExpansionButton, ToggleMergeSelected } from '../../../common/index.js';
import {
  AccountantApproval,
  VatReportAccountantApprovalFieldsFragmentDoc,
} from '../cells/accountant-approval.jsx';

export const VatReportExpensesRowFieldsFragmentDoc = graphql(
  `
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
        #   raw
      }
      # taxReducedLocalAmount {
      #   formatted
      #   raw
      # }
    }
  `,
  [VatReportAccountantApprovalFieldsFragmentDoc],
);

interface Props {
  data: FragmentOf<typeof VatReportExpensesRowFieldsFragmentDoc>;
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
  const expenseItem = readFragment(VatReportExpensesRowFieldsFragmentDoc, data);

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
        <td className="whitespace-nowrap">{expenseItem.vat?.formatted}</td>
        <td className="whitespace-nowrap">{expenseItem.localVatAfterDeduction?.formatted}</td>
        <td className="whitespace-nowrap">{expenseItem.vatAfterDeduction?.formatted}</td>
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
