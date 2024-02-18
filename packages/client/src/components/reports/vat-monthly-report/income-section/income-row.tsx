import { ReactElement, useState } from 'react';
import { Paper } from '@mantine/core';
import { VatReportIncomeRowFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';
import { ChargeExtendedInfo } from '../../../all-charges/charge-extended-info.js';
import { ToggleExpansionButton, ToggleMergeSelected } from '../../../common/index.js';
import { AccountantApproval } from '../cells/accountant-approval.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportIncomeRowFields on VatReportRecord {
    ...VatReportAccountantApprovalFields
    chargeId
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
    taxReducedLocalAmount {
      formatted
    }
  }`;

interface Props {
  data: FragmentType<typeof VatReportIncomeRowFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: string[];
  cumulativeAmount: number;
}

export const IncomeRow = ({
  data,
  toggleMergeCharge,
  mergeSelectedCharges,
  cumulativeAmount,
}: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const incomeItem = getFragmentData(VatReportIncomeRowFieldsFragmentDoc, data);

  return (
    <>
      <tr className="bg-gray-100">
        <td className="flex flex-col gap-1">
          {incomeItem.business?.name}
          {incomeItem.vatNumber && (
            <span style={{ fontSize: '10px', color: 'darkGray' }}>{incomeItem.vatNumber}</span>
          )}
        </td>
        <td>
          {incomeItem.image && (
            <a href={incomeItem.image} target="_blank" rel="noreferrer">
              <img alt="missing img" src={incomeItem.image} height={80} width={80} />
            </a>
          )}
        </td>
        <td>{incomeItem.documentSerial}</td>
        <td>{incomeItem.documentDate}</td>
        <td>{incomeItem.chargeDate}</td>
        <td>{incomeItem.amount.formatted}</td>
        <td>{incomeItem.taxReducedLocalAmount?.formatted}</td>
        <td>{'₪ ' + formatStringifyAmount(cumulativeAmount, 0)}</td>
        <AccountantApproval data={incomeItem} />
        <td>
          <div className="flex flex-col gap-2">
            <ToggleExpansionButton toggleExpansion={setOpened} isExpanded={opened} />
          </div>
        </td>
        <td>
          <ToggleMergeSelected
            toggleMergeSelected={(): void => toggleMergeCharge(incomeItem.chargeId)}
            mergeSelected={mergeSelectedCharges.includes(incomeItem.chargeId)}
          />
        </td>
      </tr>
      {opened && (
        <tr>
          <td colSpan={11}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              <ChargeExtendedInfo chargeID={incomeItem.chargeId} />
            </Paper>
          </td>
        </tr>
      )}
    </>
  );
};
