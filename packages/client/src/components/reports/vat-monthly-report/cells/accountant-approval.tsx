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

  // No <td> of its own: this is a TanStack cell renderer, and both vat tables already wrap
  // `flexRender` output in a `TableCell`, so the wrapper was nesting a td inside a td.
  return <UpdateAccountantStatus value={chargeAccountantStatus ?? undefined} chargeId={chargeId} />;
}
