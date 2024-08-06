import { ReactElement, useEffect, useState } from 'react';
import { Switch } from '@mantine/core';
import { BusinessTripAccountantApprovalFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useToggleBusinessTripAccountantApproval } from '../../../../hooks/use-toggle-business-trip-accountant-approval.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripAccountantApprovalFields on BusinessTrip {
    id
    accountantApproval
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripAccountantApprovalFieldsFragmentDoc>;
  onChange: () => void;
}

export function AccountantApproval({ data, onChange }: Props): ReactElement {
  const businessTrip = getFragmentData(BusinessTripAccountantApprovalFieldsFragmentDoc, data);
  const [checked, setChecked] = useState(businessTrip.accountantApproval);
  const { toggleBusinessTripAccountantApproval } = useToggleBusinessTripAccountantApproval();

  useEffect(() => {
    if (checked == null && businessTrip.accountantApproval != null) {
      setChecked(businessTrip.accountantApproval);
    }
  }, [checked, businessTrip.accountantApproval]);

  function onToggle(approved: boolean): void {
    setChecked(approved);
    toggleBusinessTripAccountantApproval({
      businessTripId: businessTrip.id,
      approved,
    }).then(onChange);
  }

  return (
    <Switch
      color="green"
      checked={checked}
      onChange={(event): void => {
        event.stopPropagation();
        onToggle(event.currentTarget.checked);
      }}
    />
  );
}
