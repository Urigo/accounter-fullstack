import { ReactElement } from 'react';
import { VatReportAccountantApprovalFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateChargeAccountantApproval } from '../../../../hooks/use-update-charge-accountant-approval.js';
import { UpdateAccountantStatus } from '../../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportAccountantApprovalFields on VatReportRecord {
    chargeId
    chargeAccountantStatus
  }
`;

interface Props {
  data: FragmentType<typeof VatReportAccountantApprovalFieldsFragmentDoc>;
}

export function AccountantApproval({ data }: Props): ReactElement {
  const { chargeId, chargeAccountantStatus } = getFragmentData(
    VatReportAccountantApprovalFieldsFragmentDoc,
    data,
  );
  const { updateChargeAccountantApproval } = useUpdateChargeAccountantApproval();

  return (
    <td>
      <UpdateAccountantStatus
        value={chargeAccountantStatus ?? undefined}
        onChange={status =>
          updateChargeAccountantApproval({
            chargeId,
            status,
          })
        }
      />
    </td>
  );
}
