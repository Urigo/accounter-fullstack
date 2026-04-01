import { ReactElement } from 'react';
import { gql } from 'graphql-tag';
import { useMutation } from 'urql';
import { GenerateFinancialChargesDocument } from '../../../../gql/graphql.js';
import { AccounterLoader } from '../../../common/index.js';
import { PageLayout } from '../../../layout/page-layout.jsx';
import { Button } from '../../../ui/button.jsx';
import { AuditFlowContent } from './audit-flow-content.js';

gql`
  mutation GenerateFinancialCharges($date: TimelessDate!, $ownerId: UUID!) {
    generateFinancialCharges(date: $date, ownerId: $ownerId) {
      id
      revaluationCharge {
        id
      }
      taxExpensesCharge {
        id
      }
      depreciationCharge {
        id
      }
      recoveryReserveCharge {
        id
      }
      vacationReserveCharge {
        id
      }
      bankDepositsRevaluationCharge {
        id
      }
    }
  }
`;

export const YearEndAudit = (): ReactElement => {
  const [generateRevaluationCharge] = useMutation(GenerateFinancialChargesDocument);
  const fetching = false;

  const handleGenerateCharges = () => {
    console.log('Generating charges...');
    // Implement the logic to generate the charge
  };

  const handleLockLedger = () => {
    console.log('Locking ledger...');
    // Implement the logic to lock the ledger
  };

  return fetching ? (
    <AccounterLoader />
  ) : (
    <PageLayout
      title="Year-End Audit Flow"
      description="Complete audit process for year-end financial reporting and compliance"
    >
      <AuditFlowContent />
      <Button onClick={() => handleGenerateCharges()}>Generate Revaluation Charge</Button>
      <Button onClick={handleLockLedger}>Lock Ledger</Button>
      {/* Generate charges:
      - generateRevaluationCharge
      - generateTaxExpensesCharge
      - generateDepreciationCharge
      - generateRecoveryReserveCharge
      - generateVacationReserveCharge
      - generateBankDepositsRevaluationCharge */}
      {/* lock ledger */}
    </PageLayout>
  );
};
