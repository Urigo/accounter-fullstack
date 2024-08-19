import { ReactElement, useEffect, useState } from 'react';
import { BusinessTripAccountantApprovalFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateBusinessTripAccountantApproval } from '../../../../hooks/use-update-business-trip-accountant-approval.js';
import { UpdateAccountantStatus } from '../../index.js';

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
  const [status, setStatus] = useState(businessTrip.accountantApproval);
  const { updateBusinessTripAccountantApproval } = useUpdateBusinessTripAccountantApproval();

  useEffect(() => {
    if (status == null && businessTrip.accountantApproval != null) {
      setStatus(businessTrip.accountantApproval);
    }
  }, [status, businessTrip.accountantApproval]);

  return (
    <UpdateAccountantStatus
      value={status}
      onChange={status =>
        updateBusinessTripAccountantApproval({
          businessTripId: businessTrip.id,
          status,
        }).then(onChange)
      }
    />
  );
}
