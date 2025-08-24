'use client';

import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { BalanceChargeModal } from '../../../../common/modals/balance-charge-modal.jsx';
import { getContoReportHref } from '../../../../reports/conto/index.jsx';
import { getTrialBalanceReportHref } from '../../../../reports/trial-balance-report/index.jsx';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.jsx';

interface UserType {
  type: 'new' | 'migrating' | 'continuing';
  balanceStatus?: 'verified' | 'pending' | 'missing';
}

interface Step03Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

// Sub-step components
function SubStep3A({
  level,
  year,
  adminBusinessId,
  disabled,
}: {
  level: number;
  year: number;
  adminBusinessId: string;
  disabled: boolean;
}) {
  const contoHref = getContoReportHref({
    fromDate: `${year - 1}-01-01` as TimelessDateString,
    toDate: `${year - 1}-12-31` as TimelessDateString,
    ownerIds: [adminBusinessId],
  });
  const [balanceChargeModalOpen, setBalanceChargeModalOpen] = useState(false);

  return (
    <>
      <BaseStepCard
        id="3a"
        title="Migrating Users"
        description="Create balance charge and dynamic report"
        status="pending"
        level={level}
        actions={[
          { label: 'Create Balance Charge', onClick: () => setBalanceChargeModalOpen(true) },
          { label: 'Generate Dynamic Report', href: contoHref },
          // { label: 'Upload Conto 331 Report', href: '/upload/conto331' },
        ]}
        disabled={disabled}
      />
      <BalanceChargeModal
        open={balanceChargeModalOpen}
        onOpenChange={setBalanceChargeModalOpen}
        onClose={() => setBalanceChargeModalOpen(false)}
      />
    </>
  );
}

function SubStep3B({
  level,
  year,
  adminBusinessId,
  disabled,
}: {
  level: number;
  year: number;
  adminBusinessId: string;
  disabled: boolean;
}) {
  const href = getTrialBalanceReportHref({
    toDate: `${year - 1}-12-31` as TimelessDateString,
    ownerIds: [adminBusinessId],
  });
  return (
    <BaseStepCard
      id="3b"
      title="Continuing Users"
      description="Compare with previous year final trial balance"
      status="pending"
      level={level}
      actions={[{ label: 'View Previous Year Ending Balance', href }]}
      disabled={disabled}
    />
  );
}

export default function Step03OpeningBalance(props: Step03Props) {
  const [status, setStatus] = useState<StepStatus>('loading');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!props.adminBusinessId) {
      setStatus('blocked');
    }
  }, [props.adminBusinessId]);

  // Report status changes to parent
  useEffect(() => {
    if (props.onStatusChange) {
      props.onStatusChange(props.id, status);
    }
  }, [status, props.onStatusChange, props.id]);

  useEffect(() => {
    const fetchUserType = async () => {
      try {
        // Simulate API call to determine user type
        await new Promise(resolve => setTimeout(resolve, 600));

        const data: UserType = {
          type: 'continuing',
          balanceStatus: 'pending',
        };

        setUserType(data);

        if (data.type === 'new') {
          setStatus('completed');
        } else if (data.balanceStatus === 'verified') {
          setStatus('completed');
        } else {
          setStatus('pending');
        }
      } catch (error) {
        console.error('Error fetching user type:', error);
        setStatus('blocked');
      }
    };

    fetchUserType();
  }, []);

  return (
    <>
      <BaseStepCard
        {...props}
        status={status}
        icon={<Calculator className="h-4 w-4" />}
        hasSubsteps
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      {props.adminBusinessId && (
        <Collapsible open={isExpanded}>
          <CollapsibleContent className="space-y-2">
            <SubStep3A
              level={1}
              year={props.year}
              adminBusinessId={props.adminBusinessId}
              disabled={userType?.type !== 'migrating'}
            />
            <SubStep3B
              level={1}
              year={props.year}
              adminBusinessId={props.adminBusinessId}
              disabled={userType?.type !== 'continuing'}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}
