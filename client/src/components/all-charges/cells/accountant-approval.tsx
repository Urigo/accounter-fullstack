import { useState } from 'react';
import { Switch } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesAccountantApprovalFieldsFragmentDoc } from '../../../gql/graphql';
import { useToggleChargeAccountantApproval } from '../../../hooks/use-toggle-charge-accountant-approval';

/* GraphQL */ `
  fragment AllChargesAccountantApprovalFields on Charge {
    id
    accountantApproval {
      approved
    }
  }
`;

interface Props {
  data: FragmentType<typeof AllChargesAccountantApprovalFieldsFragmentDoc>;
}

export function AccountantApproval({ data }: Props) {
  const charge = getFragmentData(AllChargesAccountantApprovalFieldsFragmentDoc, data);
  const [checked, setChecked] = useState(charge.accountantApproval.approved);
  const { toggleChargeAccountantApproval } = useToggleChargeAccountantApproval();

  function onToggle(approved: boolean) {
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
        onChange={event => onToggle(event.currentTarget.checked)}
      />
    </td>
  );
}
