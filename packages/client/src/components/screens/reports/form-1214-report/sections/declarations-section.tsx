import type { ReactElement } from 'react';
import {
  Form1214DeclarationsSectionFragmentDoc,
  type Form1214DeclarationsSectionFragment,
} from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { DetailList, Section } from './section-layout.js';

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
      }
    }
  }
`;

type Declarations = Form1214DeclarationsSectionFragment['profile']['declarations'];

const REQUIRED_DECLARATIONS: Array<[keyof Declarations, string]> = [
  ['hasTaxPlanningAction', 'Tax planning action (878)'],
  ['hadRelatedPartyTransactions', 'Related-party transactions (879)'],
  ['controlsBodyOfPersons', 'Controls a body of persons (880)'],
  ['holdsRightsInBodyOfPersons', 'Holds rights in a body of persons (881)'],
  ['appliesAccountingStandards', 'Applies accounting standards (882)'],
  ['directorsReceivedOpinion', 'Directors received an opinion (1029)'],
  ['tookReportablePosition', 'Took a reportable position (1030)'],
];

type Props = {
  data: FragmentType<typeof Form1214DeclarationsSectionFragmentDoc>;
};

/** The required yes/no declarations of record 1000. */
export function Form1214DeclarationsSection({ data }: Props): ReactElement {
  const { declarations } = getFragmentData(Form1214DeclarationsSectionFragmentDoc, data).profile;
  return (
    <Section id="declarations" title="Declarations">
      <DetailList
        items={REQUIRED_DECLARATIONS.map(([key, label]) => {
          const value = declarations[key];
          return [label, value == null ? 'Not set' : value ? 'Yes' : 'No'];
        })}
      />
    </Section>
  );
}
