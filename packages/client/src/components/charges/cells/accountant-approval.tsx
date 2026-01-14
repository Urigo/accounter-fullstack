import { useEffect, useState, type ReactElement } from 'react';
import { ChargesTableAccountantApprovalFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { UpdateAccountantStatus } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableAccountantApprovalFields on Charge {
    id
    accountantApproval
  }
`;

interface Props {
  data: FragmentType<typeof ChargesTableAccountantApprovalFieldsFragmentDoc>;
  onChange: () => void;
}

export function AccountantApproval({ data, onChange }: Props): ReactElement {
  const charge = getFragmentData(ChargesTableAccountantApprovalFieldsFragmentDoc, data);
  const [status, setStatus] = useState(charge.accountantApproval);

  useEffect(() => {
    if (status == null && charge.accountantApproval != null) {
      setStatus(charge.accountantApproval);
    }
  }, [status, charge.accountantApproval]);

  return (
    <td>
      <UpdateAccountantStatus chargeId={charge.id} value={status} onChange={onChange} />
    </td>
  );
}
