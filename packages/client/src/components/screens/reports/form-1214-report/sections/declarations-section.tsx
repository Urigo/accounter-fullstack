import type { ReactElement } from 'react';
import { Form1214DeclarationsSectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Form1214DeclarationsEditor } from '../declarations-editor.js';
import { Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214DeclarationsSection on Report1214 {
    id
    profile {
      id
      declarations {
        hasTaxPlanningAction
        hadRelatedPartyTransactions
        controlsBodyOfPersons
        holdsRightsInBodyOfPersons
        appliesAccountingStandards
        directorsReceivedOpinion
        tookReportablePosition
        reportablePositions
        form6111Obligation
        financialStatementsAttached
        familyCompany {
          representativeFileNumber
        }
        isHouseCompany
        form1343Attached
        form1344Attached
        claimsCapitalInvestmentLawBenefits
        preferredEnterprise
        beneficiaryEnterprise {
          noticeDate
        }
        dividendDistributed
        specialYear {
          balanceSheetDate
        }
        foreignInvestors
        consolidatedReport
        partnerInPartnership
        isKibbutz
        requestsAdvancePayments
        hasBuildingIncome
        isTrustBeneficiary
        nonDeductibleSalaryExpenses
        fewMembersCompany62A
        partOfMultinationalGroup
        noBankAccount
        hasCapitalGainsAppendix
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214DeclarationsSectionFragmentDoc>;
};

/** The declarations of record 1000: the required yes/no answers and the optional ones. */
export function Form1214DeclarationsSection({ data }: Props): ReactElement {
  const { declarations } = getFragmentData(Form1214DeclarationsSectionFragmentDoc, data).profile;
  return (
    <Section id="declarations" title="Declarations">
      <Form1214DeclarationsEditor declarations={declarations} />
    </Section>
  );
}
