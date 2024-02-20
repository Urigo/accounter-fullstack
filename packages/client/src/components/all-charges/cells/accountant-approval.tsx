import { ReactElement, useState } from 'react';
import { Switch } from '@mantine/core';
import { AllChargesAccountantApprovalFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { useToggleChargeAccountantApproval } from '../../../hooks/use-toggle-charge-accountant-approval.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesAccountantApprovalFields on Charge {
    id
    accountantApproval
  }
`;

interface Props {
  data: FragmentType<typeof AllChargesAccountantApprovalFieldsFragmentDoc>;
}

export function AccountantApproval({ data }: Props): ReactElement {
  const charge = getFragmentData(AllChargesAccountantApprovalFieldsFragmentDoc, data);
  const [checked, setChecked] = useState(charge.accountantApproval);
  const { toggleChargeAccountantApproval } = useToggleChargeAccountantApproval();

  function onToggle(approved: boolean): void {
    setChecked(approved);
    toggleChargeAccountantApproval({
      chargeId: charge.id,
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
