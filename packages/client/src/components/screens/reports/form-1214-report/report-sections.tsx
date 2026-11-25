import type { ReactElement } from 'react';
import { Form1214ReportSectionsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { Form1214AmountsSection } from './sections/amounts-section.js';
import { Form1214CompanySection } from './sections/company-section.js';
import { Form1214DeclarationsSection } from './sections/declarations-section.js';
import { Form1214RdInvestmentsSection } from './sections/rd-investments-section.js';
import { Form1214RelatedCompaniesSection } from './sections/related-companies-section.js';
import { Form1214ShareholdersSection } from './sections/shareholders-section.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214ReportSections on Report1214 {
    id
    ...Form1214ShareholdersSection
    ...Form1214CompanySection
    ...Form1214DeclarationsSection
    ...Form1214RelatedCompaniesSection
    ...Form1214RdInvestmentsSection
    ...Form1214AmountsSection
  }
`;

type Props = {
  report: FragmentType<typeof Form1214ReportSectionsFragmentDoc>;
};

/** The data form 1214 is built from, one section per part of the form. */
export function Form1214ReportSections({ report }: Props): ReactElement {
  const data = getFragmentData(Form1214ReportSectionsFragmentDoc, report);
  return (
    <div className="space-y-4">
      <Form1214ShareholdersSection data={data} />
      <Form1214CompanySection data={data} />
      <Form1214DeclarationsSection data={data} />
      <Form1214RelatedCompaniesSection data={data} />
      <Form1214RdInvestmentsSection data={data} />
      <Form1214AmountsSection data={data} />
    </div>
  );
}
