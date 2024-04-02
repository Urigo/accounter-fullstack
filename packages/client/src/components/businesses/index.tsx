import { ReactElement, useContext, useEffect, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Table, Tooltip } from '@mantine/core';
import { AllBusinessesForScreenDocument, AllBusinessesForScreenQuery } from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { AccounterLoader } from '../common/index.js';
import { AllBusinessesRow } from './all-businesses-row.js';
import { BusinessesFilters } from './businesses-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllBusinessesForScreen($page: Int, $limit: Int, $name: String) {
    allBusinesses(page: $page, limit: $limit, name: $name) {
      nodes {
        __typename
        id
        name
        ... on LtdFinancialEntity {
            ...AllBusinessesRowFields
        }

      }
      pageInfo {
        totalPages
      }
    }
  }
`;

export const Businesses = (): ReactElement => {
  const { get } = useUrlQuery();
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 1);
  const [businessName, setBusinessName] = useState(
    get('name') ? (get('page') as string) : undefined,
  );
  const { setFiltersContext } = useContext(FiltersContext);

  const [{ data, fetching }] = useQuery({
    query: AllBusinessesForScreenDocument,
    variables: {
      page: activePage,
      limit: 100,
      name: businessName,
    },
  });

  // Footer
  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <BusinessesFilters
          activePage={activePage}
          setPage={setActivePage}
          businessName={businessName}
          setBusinessName={setBusinessName}
          totalPages={data?.allBusinesses?.pageInfo.totalPages}
        />
        <Tooltip label="Expand all businesses">
          <ActionIcon variant="default" onClick={(): void => setIsAllOpened(i => !i)} size={30}>
            {isAllOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
          </ActionIcon>
        </Tooltip>
      </div>,
    );
  }, [
    data,
    activePage,
    businessName,
    isAllOpened,
    setFiltersContext,
    setActivePage,
    setBusinessName,
    setIsAllOpened,
  ]);

  const businesses =
    data?.allBusinesses?.nodes
      .filter(business => business.__typename === 'LtdFinancialEntity')
      .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)) ?? [];

  return fetching ? (
    <AccounterLoader />
  ) : (
    <Table striped highlightOnHover>
      <thead className="sticky top-0 z-20">
        <tr className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl">
          <th>Name</th>
          <th>Hebrew Name</th>
          <th>More Info</th>
        </tr>
      </thead>
      <tbody>
        {businesses.map(business => (
          <AllBusinessesRow
            key={business.id}
            data={
              business as Extract<
                NonNullable<AllBusinessesForScreenQuery['allBusinesses']>['nodes'][number],
                { __typename: 'LtdFinancialEntity' }
              >
            }
            isAllOpened={isAllOpened}
          />
        ))}
      </tbody>
    </Table>
  );
};
