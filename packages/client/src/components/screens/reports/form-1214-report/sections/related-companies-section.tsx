import type { ReactElement } from 'react';
import { Form1214RelatedCompaniesSectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table.js';
import { Empty, Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214RelatedCompaniesSection on Report1214 {
    id
    profile {
      id
      relatedCompanies {
        companyName
        companyFileNumber
        relationType
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214RelatedCompaniesSectionFragmentDoc>;
};

/** Related companies in Israel or abroad (records 1010). */
export function Form1214RelatedCompaniesSection({ data }: Props): ReactElement {
  const { relatedCompanies } = getFragmentData(
    Form1214RelatedCompaniesSectionFragmentDoc,
    data,
  ).profile;
  return (
    <Section id="related-companies" title="Related companies">
      {relatedCompanies.length === 0 ? (
        <Empty>No related companies are saved for this year.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>File number</TableHead>
              <TableHead>Relation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relatedCompanies.map((company, index) => (
              <TableRow key={index}>
                <TableCell dir="auto">{company.companyName}</TableCell>
                <TableCell className="font-mono">{company.companyFileNumber ?? '-'}</TableCell>
                <TableCell>{company.relationType}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
