'use client';

import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';

interface UserType {
  type: 'new' | 'migrating' | 'continuing';
  balanceStatus?: 'verified' | 'pending' | 'missing';
}

interface Step03Props extends BaseStepProps {}

// Sub-step components
function SubStep3A({ level }: { level: number }) {
  return (
    <BaseStepCard
      id="3a"
      title="New Users"
      description="Not relevant for new users"
      status="completed"
      level={level}
      actions={[{ label: 'Mark as N/A', onClick: () => {} }]}
    />
  );
}

function SubStep3B({ level }: { level: number }) {
  return (
    <BaseStepCard
      id="3b"
      title="Migrating Users"
      description="Create balance charge and dynamic report"
      status="pending"
      level={level}
      actions={[
        { label: 'Create Balance Charge', href: '/balance/create' },
        { label: 'Generate Dynamic Report', href: '/reports/dynamic' },
        { label: 'Upload Conto 331 Report', href: '/upload/conto331' },
      ]}
    />
  );
}

function SubStep3C({ level }: { level: number }) {
  return (
    <BaseStepCard
      id="3c"
      title="Continuing Users"
      description="Compare with previous year final trial balance"
      status="pending"
      level={level}
      actions={[
        { label: 'Compare Trial Balance', href: '/balance/compare' },
        { label: 'View Previous Year', href: '/reports/previous-year' },
      ]}
    />
  );
}

export default function Step03OpeningBalance(props: Step03Props) {
  const [status, setStatus] = useState<StepStatus>('loading');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
        hasSubsteps={true}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      <Collapsible open={isExpanded}>
        <CollapsibleContent className="space-y-2">
          <SubStep3A level={1} />
          <SubStep3B level={1} />
          <SubStep3C level={1} />
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
