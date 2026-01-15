import { useEffect, useState, type ReactElement } from 'react';
import { BusinessTripAccountantApprovalFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
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

  useEffect(() => {
    if (status == null && businessTrip.accountantApproval != null) {
      setStatus(businessTrip.accountantApproval);
    }
  }, [status, businessTrip.accountantApproval]);

  return (
    <UpdateAccountantStatus value={status} businessTripId={businessTrip.id} onChange={onChange} />
  );
}
