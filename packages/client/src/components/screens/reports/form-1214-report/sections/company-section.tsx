import type { ReactElement } from 'react';
import { Form1214CompanySectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Form1214CompanyEditor, Form1214PreparerEditor } from '../company-editor.js';
import { useForm1214Report } from '../report-context.js';
import { Section } from './section-layout.js';

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
        fax {
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
        contactName
        name
        profession
        licensedDealerNumber
        address
        phone {
          prefix
          number
        }
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214CompanySectionFragmentDoc>;
};

/**
 * The company details saved on top of the books, and the report's preparer. Each has its own
 * editor and is saved on its own.
 */
export function Form1214CompanySection({ data }: Props): ReactElement {
  const { company, preparer } = getFragmentData(Form1214CompanySectionFragmentDoc, data).profile;
  // A draft belongs to its year: another year starts a fresh one
  const { year } = useForm1214Report();
  return (
    <Section id="company" title="Company details">
      <div className="space-y-6">
        <Form1214CompanyEditor key={year} company={company} />
        <Form1214PreparerEditor key={year} preparer={preparer} />
      </div>
    </Section>
  );
}
