import type { ReactElement } from 'react';
import { Form1214ShareholdersSectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { ShareholdersEditor } from '../shareholders-editor.js';
import { Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214ShareholdersSection on Report1214 {
    id
    shareholders {
      id
      idNumber
      fullName
      isControllingShareholder
      dividendRightsPercent
      votingRightsPercent
      otherRightsPercent
      isMaterialShareholder
      salaryMonths1To9
      salaryMonths10To12
      otherPayments
      businessId
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214ShareholdersSectionFragmentDoc>;
};

/** The shareholders of the year (records 1020), editable. */
export function Form1214ShareholdersSection({ data }: Props): ReactElement {
  const { shareholders } = getFragmentData(Form1214ShareholdersSectionFragmentDoc, data);
  return (
    <Section id="shareholders" title="Shareholders">
      <ShareholdersEditor shareholders={shareholders} />
    </Section>
  );
}
