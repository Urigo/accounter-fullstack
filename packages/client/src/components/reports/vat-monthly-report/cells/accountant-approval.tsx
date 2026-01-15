import type { ReactElement } from 'react';
import { VatReportAccountantApprovalFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
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

  return (
    <td>
      <UpdateAccountantStatus value={chargeAccountantStatus ?? undefined} chargeId={chargeId} />
    </td>
  );
}
