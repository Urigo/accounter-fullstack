import { useState } from 'react';
import { ROUTES } from '@/router/routes.js';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { BalanceChargeModal } from '../../../../common/modals/balance-charge-modal.js';
import { BaseStepCard, type StepStatus } from '../step-base.js';

export function MigratingSubsteps({
  year,
  adminBusinessId,
  balanceChargeId,
}: {
  year: number;
  adminBusinessId: string;
  balanceChargeId: string | null;
}) {
  const contoHref = ROUTES.REPORTS.CONTO({
    fromDate: `${year - 1}-01-01` as TimelessDateString,
    toDate: `${year - 1}-12-31` as TimelessDateString,
    ownerIds: [adminBusinessId],
  });
  const [balanceChargeModalOpen, setBalanceChargeModalOpen] = useState(false);

  const subStatus: StepStatus = balanceChargeId ? 'completed' : 'pending';

  return (
    <BaseStepCard
      id="3a"
      title="Enter Opening Balances"
      description="Create a balance charge and save the opening balance Conto snapshot template to import prior-year balances"
      status={subStatus}
      level={1}
      actions={[
        balanceChargeId
          ? {
              label: 'Balance Charge',
              href: ROUTES.CHARGES.DETAIL(balanceChargeId),
            }
          : {
              label: 'Create Balance Charge',
              onClick: () => setBalanceChargeModalOpen(true),
            },
        {
          label: 'Upload Conto Report',
          href: contoHref,
          disabled: true,
        },
      ]}
      disabled={false}
    >
      <BalanceChargeModal
        open={balanceChargeModalOpen}
        onOpenChange={setBalanceChargeModalOpen}
        onClose={() => setBalanceChargeModalOpen(false)}
      />
    </BaseStepCard>
  );
}
