import { useState } from 'react';
import { Switch } from '@mantine/core';
import gql from 'graphql-tag';
import { AllChargesAccountantApprovalFieldsFragment } from '../../../__generated__/types';
import { useToggleChargeAccountantApproval } from '../../../hooks/use-toggle-charge-accountant-approval';

gql`
  fragment AllChargesAccountantApprovalFields on Charge {
    id
    accountantApproval {
      approved
    }
  }
`;

interface Props {
  data: AllChargesAccountantApprovalFieldsFragment;
}

export function AccountantApproval({ data }: Props) {
  const [checked, setChecked] = useState(data.accountantApproval.approved);
  const { mutate } = useToggleChargeAccountantApproval();

  function onToggle(approved: boolean) {
    setChecked(approved);
    mutate({
      chargeId: data.id,
      approved,
    });
  }

  return (
    <Switch
      color="green"
      checked={checked}
      onChange={event => onToggle(event.currentTarget.checked)}
    />
  );
}
