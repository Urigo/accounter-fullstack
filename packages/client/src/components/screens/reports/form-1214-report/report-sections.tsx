import type { ReactElement, ReactNode } from 'react';
import {
  Form1214ReportSectionsFragmentDoc,
  Report1214AmountSource,
  type Form1214ReportSectionsFragment,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { Badge } from '../../../ui/badge.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214ReportSections on Report1214 {
    id
    shareholders {
      id
      idNumber
      fullName
      isControllingShareholder
      dividendRightsPercent
      votingRightsPercent
    }
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
      declarations {
        hasTaxPlanningAction
        hadRelatedPartyTransactions
        controlsBodyOfPersons
        holdsRightsInBodyOfPersons
        appliesAccountingStandards
        directorsReceivedOpinion
        tookReportablePosition
      }
      preparer {
        officeName
        name
      }
      relatedCompanies {
        companyName
        companyFileNumber
        relationType
      }
      rdInvestments {
        companyName
        companyFileNumber
        investmentAmount
      }
    }
    amounts {
      code
      amount
      source
      computedAmount
      label
    }
  }
`;

type Report = Form1214ReportSectionsFragment;

type Props = {
  report: FragmentType<typeof Form1214ReportSectionsFragmentDoc>;
};

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatNumber(value: number | null | undefined): string {
  return value == null ? '-' : numberFormat.format(value);
}

/** The data form 1214 is built from, read-only, one section per part of the form. */
export function Form1214ReportSections({ report }: Props): ReactElement {
  const data = getFragmentData(Form1214ReportSectionsFragmentDoc, report);
  return (
    <div className="space-y-4">
      <ShareholdersSection shareholders={data.shareholders} />
      <CompanySection profile={data.profile} />
      <DeclarationsSection declarations={data.profile.declarations} />
      <RelatedCompaniesSection relatedCompanies={data.profile.relatedCompanies} />
      <RdInvestmentsSection rdInvestments={data.profile.rdInvestments} />
      <AmountsSection amounts={data.amounts} />
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }): ReactElement {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function ShareholdersSection({
  shareholders,
}: {
  shareholders: Report['shareholders'];
}): ReactElement {
  const dividendTotal = shareholders.reduce(
    (total, shareholder) => total + (shareholder.dividendRightsPercent ?? 0),
    0,
  );
  return (
    <Section id="shareholders" title="Shareholders">
      {shareholders.length === 0 ? (
        <Empty>No shareholders are saved for this year.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Controlling</TableHead>
              <TableHead className="text-right">Dividend rights %</TableHead>
              <TableHead className="text-right">Voting rights %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shareholders.map(shareholder => (
              <TableRow key={shareholder.id}>
                <TableCell dir="auto">{shareholder.fullName}</TableCell>
                <TableCell className="font-mono">{shareholder.idNumber}</TableCell>
                <TableCell>{shareholder.isControllingShareholder ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(shareholder.dividendRightsPercent)}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(shareholder.votingRightsPercent)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatNumber(dividendTotal)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

function DetailList({ items }: { items: Array<[string, ReactNode]> }): ReactElement {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <dt className="text-muted-foreground">{label}:</dt>
          <dd dir="auto">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompanySection({ profile }: { profile: Report['profile'] }): ReactElement {
  const { company, preparer } = profile;
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

const REQUIRED_DECLARATIONS: Array<[keyof Report['profile']['declarations'], string]> = [
  ['hasTaxPlanningAction', 'Tax planning action (878)'],
  ['hadRelatedPartyTransactions', 'Related-party transactions (879)'],
  ['controlsBodyOfPersons', 'Controls a body of persons (880)'],
  ['holdsRightsInBodyOfPersons', 'Holds rights in a body of persons (881)'],
  ['appliesAccountingStandards', 'Applies accounting standards (882)'],
  ['directorsReceivedOpinion', 'Directors received an opinion (1029)'],
  ['tookReportablePosition', 'Took a reportable position (1030)'],
];

function DeclarationsSection({
  declarations,
}: {
  declarations: Report['profile']['declarations'];
}): ReactElement {
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

function RelatedCompaniesSection({
  relatedCompanies,
}: {
  relatedCompanies: Report['profile']['relatedCompanies'];
}): ReactElement {
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

function RdInvestmentsSection({
  rdInvestments,
}: {
  rdInvestments: Report['profile']['rdInvestments'];
}): ReactElement {
  return (
    <Section id="rd-investments" title="R&D investments">
      {rdInvestments.length === 0 ? (
        <Empty>No R&D investments are saved for this year.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>File number</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rdInvestments.map((investment, index) => (
              <TableRow key={index}>
                <TableCell dir="auto">{investment.companyName}</TableCell>
                <TableCell className="font-mono">{investment.companyFileNumber ?? '-'}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(investment.investmentAmount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

function AmountsSection({ amounts }: { amounts: Report['amounts'] }): ReactElement {
  return (
    <Section id="amounts" title="Amounts (record 1000)">
      {amounts.length === 0 ? (
        <Empty>No amounts are computed or entered for this year.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Computed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {amounts.map(amount => (
              <TableRow key={amount.code}>
                <TableCell className="font-mono">{amount.code}</TableCell>
                <TableCell dir="auto">{amount.label ?? ''}</TableCell>
                <TableCell className="text-right">{formatNumber(amount.amount)}</TableCell>
                <TableCell>
                  {amount.source === Report1214AmountSource.Override ? (
                    <Badge variant="outline">Override</Badge>
                  ) : (
                    <Badge variant="secondary">Computed</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{formatNumber(amount.computedAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
