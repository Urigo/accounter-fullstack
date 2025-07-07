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
import {
  DEPRECIATION_REPORT_FILTERS_QUERY_PARAM,
  DepreciationReportFilters,
  encodeDepreciationReportFilters,
} from './depreciation-report-filters.js';
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

export function getDepreciationReportHref(filter?: DepreciationReportFilter | null): string {
  const params = new URLSearchParams();

  const depreciationReportFilters = encodeDepreciationReportFilters(filter);
  if (depreciationReportFilters) {
    // Add it as a single encoded parameter
    params.append(DEPRECIATION_REPORT_FILTERS_QUERY_PARAM, depreciationReportFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '';
  return `/reports/depreciation${queryParams}`;
}

export const DepreciationReport = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { userContext } = useContext(UserContext);
  const { get } = useUrlQuery();
  const initialFilters = useMemo((): DepreciationReportFilter => {
    const defaultFilters: DepreciationReportFilter = {
      financialEntityId: userContext?.context.adminBusinessId,
      year: new Date().getFullYear(),
    };
    const uriFilters = get(DEPRECIATION_REPORT_FILTERS_QUERY_PARAM);
    if (uriFilters) {
      try {
        return JSON.parse(decodeURIComponent(uriFilters)) as DepreciationReportFilter;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {}
    }
    return defaultFilters;
  }, [userContext?.context.adminBusinessId]);
  const [filter, setFilter] = useState<DepreciationReportFilter>(initialFilters);

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
              <TableHead className="whitespace-normal">Assets List and Descriptions</TableHead>
              <TableHead className="whitespace-normal">Date of Purchase</TableHead>
              <TableHead className="whitespace-normal">Activation Date</TableHead>
              <TableHead className="whitespace-normal">Original Cost</TableHead>
              <TableHead className="whitespace-normal">Changes During the Year</TableHead>
              <TableHead className="whitespace-normal">Total Depreciable Assets</TableHead>
              <TableHead className="whitespace-normal">Statutory Depreciation Rate</TableHead>
              <TableHead className="whitespace-normal">Claimed Depreciation Rate</TableHead>
              <TableHead className="whitespace-normal">Depreciation Claimed This Year</TableHead>
              <TableHead className="whitespace-normal">
                Previous Tax Years Accumulated Depreciation
              </TableHead>
              <TableHead className="whitespace-normal">Total Depreciation</TableHead>
              <TableHead className="whitespace-normal">Net Book Value</TableHead>
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
