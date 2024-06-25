import { ReactElement, useState } from 'react';
import { Switch } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
import { useToggleChargeAccountantApproval } from '../../../../hooks/use-toggle-charge-accountant-approval.js';

export const VatReportAccountantApprovalFieldsFragmentDoc = graphql(`
  fragment VatReportAccountantApprovalFields on VatReportRecord {
    chargeId
    chargeAccountantReviewed
  }
`);

interface Props {
  data: FragmentOf<typeof VatReportAccountantApprovalFieldsFragmentDoc>;
}

export function AccountantApproval({ data }: Props): ReactElement {
  const { chargeId, chargeAccountantReviewed } = readFragment(
    VatReportAccountantApprovalFieldsFragmentDoc,
    data,
  );
  const [checked, setChecked] = useState(chargeAccountantReviewed ?? false);
  const { toggleChargeAccountantApproval } = useToggleChargeAccountantApproval();

  function onToggle(approved: boolean): void {
    setChecked(approved);
    toggleChargeAccountantApproval({
      chargeId,
      approved,
    });
  }

  return (
    <td>
      <Switch
        color="green"
        checked={checked}
        onChange={(event): void => onToggle(event.currentTarget.checked)}
      />
    </td>
  );
}
