import { ReactElement, useEffect, useState } from 'react';
import { ChargesTableAccountantApprovalFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { useUpdateChargeAccountantApproval } from '../../../hooks/use-update-charge-accountant-approval.js';
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
  const { updateChargeAccountantApproval } = useUpdateChargeAccountantApproval();

  useEffect(() => {
    if (status == null && charge.accountantApproval != null) {
      setStatus(charge.accountantApproval);
    }
  }, [status, charge.accountantApproval]);

  return (
    <td>
      <UpdateAccountantStatus
        value={status}
        onChange={status =>
          updateChargeAccountantApproval({
            chargeId: charge.id,
            status,
          }).then(onChange)
        }
      />
    </td>
  );
}
