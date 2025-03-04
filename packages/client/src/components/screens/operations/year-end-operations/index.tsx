/* eslint-disable @typescript-eslint/no-unused-expressions */
import { ReactElement } from 'react';
import { gql } from 'graphql-tag';
import { GenerateFinancialChargesDocument } from 'packages/client/src/gql/graphql.js';
import { useMutation } from 'urql';
import { AccounterLoader, Button } from '../../../common/index.js';
import { PageLayout } from '../../../layout/page-layout.js';

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

export const YearEndOperations = (): ReactElement => {
  const [generateRevaluationCharge] = useMutation(GenerateFinancialChargesDocument);
  const fetching = true;

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
      title="Year-End Operations"
      description="Execute operations for the end of the year"
    >
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
