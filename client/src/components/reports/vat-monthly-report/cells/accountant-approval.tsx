import { ReactElement, useState } from 'react';
import { Switch } from '@mantine/core';
import { VatReportAccountantApprovalFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useToggleChargeAccountantApproval } from '../../../../hooks/use-toggle-charge-accountant-approval';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportAccountantApprovalFields on VatReportRecord {
    chargeId
    chargeAccountantReviewed
  }`;

interface Props {
  data: FragmentType<typeof VatReportAccountantApprovalFieldsFragmentDoc>;
}

export function AccountantApproval({ data }: Props): ReactElement {
  const { chargeId, chargeAccountantReviewed } = getFragmentData(
    VatReportAccountantApprovalFieldsFragmentDoc,
    data,
  );
  const [checked, setChecked] = useState(chargeAccountantReviewed ?? false);
  const { toggleChargeAccountantApproval } = useToggleChargeAccountantApproval();

  function onToggle(approved: boolean): void {
    setChecked(approved);
    toggleChargeAccountantApproval({
      chargeId,
      approved,
    });
  }

  return (
    <td>
      <Switch
        color="green"
        checked={checked}
        onChange={(event): void => onToggle(event.currentTarget.checked)}
      />
    </td>
  );
}
