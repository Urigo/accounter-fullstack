import type { ReactElement } from 'react';
import { Form1214CompanySectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { DetailList, Empty, Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214CompanySection on Report1214 {
    id
    profile {
      id
      company {
        registeredName
        phone {
          prefix
          number
        }
        email
        occupationDescription
        mailingAddress
        businessAddress
        booksAddress
        withholdingFileNumber
      }
      preparer {
        officeName
        name
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214CompanySectionFragmentDoc>;
};

/** The company details saved on top of the books, and the report's preparer. */
export function Form1214CompanySection({ data }: Props): ReactElement {
  const { company, preparer } = getFragmentData(Form1214CompanySectionFragmentDoc, data).profile;
  const items: Array<[string, string | null | undefined]> = [
    ['Registered name', company.registeredName],
    ['Phone', company.phone ? `${company.phone.prefix}-${company.phone.number}` : null],
    ['Email', company.email],
    ['Occupation', company.occupationDescription],
    ['Mailing address', company.mailingAddress],
    ['Business address', company.businessAddress],
    ['Books address', company.booksAddress],
    ['Withholding file number', company.withholdingFileNumber],
    ['Preparer', preparer ? (preparer.officeName ?? preparer.name) : null],
  ];
  const setItems = items.filter((item): item is [string, string] => !!item[1]);
  return (
    <Section id="company" title="Company details">
      {setItems.length === 0 ? (
        <Empty>The company details come from the books; no additions are saved.</Empty>
      ) : (
        <DetailList items={setItems} />
      )}
    </Section>
  );
}
