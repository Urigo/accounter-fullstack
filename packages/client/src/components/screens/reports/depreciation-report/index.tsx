import { Fragment, ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import {
  DepreciationReportFilter,
  DepreciationReportScreenDocument,
} from '../../../../gql/graphql.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { UserContext } from '../../../../providers/user-provider.js';
import { AccounterLoader } from '../../../common/index.js';
import { PageLayout } from '../../../layout/page-layout.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { DepreciationRecordRow } from './depreciation-record-row.js';
import { DepreciationReportFilters } from './depreciation-report-filters.js';
import { DepreciationSummaryRow } from './depreciation-summary-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DepreciationReportRecordCore on DepreciationCoreRecord {
    id
    originalCost
    reportYearDelta
    totalDepreciableCosts
    reportYearClaimedDepreciation
    pastYearsAccumulatedDepreciation
    totalDepreciation
    netValue
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DepreciationReportScreen($filters: DepreciationReportFilter!) {
    depreciationReport(filters: $filters) {
      id
      year
      categories {
        id
        category {
          id
          name
          percentage
        }
        records {
          id
          chargeId
          description
          purchaseDate
          activationDate
          statutoryDepreciationRate
          claimedDepreciationRate
          ...DepreciationReportRecordCore
        }
        summary {
          id
          ...DepreciationReportRecordCore
        }
      }
      summary {
        id
        ...DepreciationReportRecordCore
      }
    }
  }
`;

export const DepreciationReport = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { userContext } = useContext(UserContext);
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<DepreciationReportFilter>(
    get('depreciationReportFilters')
      ? (JSON.parse(
          decodeURIComponent(get('depreciationReportFilters') as string),
        ) as DepreciationReportFilter)
      : {
          financialEntityId: userContext?.context.adminBusinessId,
          year: new Date().getFullYear(),
        },
  );

  const [{ data, fetching }] = useQuery({
    query: DepreciationReportScreenDocument,
    variables: {
      filters: filter,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <DepreciationReportFilters filter={filter} setFilter={setFilter} />
      </div>,
    );
  }, [filter, setFiltersContext, setFilter]);

  const description = useMemo(() => {
    return `Depreciation Report for ${filter.year}`;
  }, [filter.year]);

  return (
    <PageLayout title="Depreciation Report" description={description}>
      {fetching ? (
        <AccounterLoader />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="font-bold text-xl">
              <TableHead colSpan={6} className="text-center border-x">
                List of Assets and Costs
              </TableHead>
              <TableHead colSpan={5} className="text-center border-x">
                Depreciation
              </TableHead>
              <TableHead className="text-center border-x">Remaining</TableHead>
            </TableRow>
            <TableRow className="border-b border-black">
              <TableHead>Assets List and Descriptions</TableHead>
              <TableHead>Date of Purchase</TableHead>
              <TableHead>Activation Date</TableHead>
              <TableHead>Original Cost</TableHead>
              <TableHead>Changes During the Year</TableHead>
              <TableHead>Total Depreciable Assets</TableHead>
              <TableHead>Statutory Depreciation Rate</TableHead>
              <TableHead>Claimed Depreciation Rate</TableHead>
              <TableHead>Depreciation Claimed This Year</TableHead>
              <TableHead>Previous Tax Years Accumulated Depreciation</TableHead>
              <TableHead>Total Depreciation</TableHead>
              <TableHead>Net Book Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.depreciationReport && (
              <>
                {data.depreciationReport.categories.map((category, index) => (
                  <Fragment key={category.id}>
                    <TableRow className="font-bold">
                      <TableCell>{`Category ${index + 1}`}</TableCell>
                      <TableCell colSpan={2}>{category.category.name}</TableCell>
                      <TableCell colSpan={3} />
                      <TableCell>
                        {formatStringifyAmount(category.category.percentage, 0)}%
                      </TableCell>
                      <TableCell colSpan={5} />
                    </TableRow>
                    {category.records
                      .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
                      .map(record => (
                        <DepreciationRecordRow key={record.id} record={record} />
                      ))}
                    <DepreciationSummaryRow
                      data={category.summary}
                      groupName={category.category.name}
                    />
                  </Fragment>
                ))}
                <DepreciationSummaryRow data={data.depreciationReport.summary} />
              </>
            )}
          </TableBody>
        </Table>
      )}
    </PageLayout>
  );
};
