import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { AllTagsPageDocument } from '../../gql/graphql.js';
import { TagsTable } from './tags-table.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { AddTagForm } from './add-tag-form.js';
import { AllTagsPagePagination } from './tags-page-pagination.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllTagsPage($limit: Int!, $offset: Int!) {
    allTagsPaginated(filter: { limit: $limit, offset: $offset }) {
      nodes {
        ...AllTabsTableFields
      }
      pageInfo {
        totalPages
        currentPage
        pageSize
      }
    }
  }
`;

export const TagsPage = (): ReactElement => {
    const { setFiltersContext } = useContext(FiltersContext);
    const { get, set } = useUrlQuery();
    const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 1);
    const limit = 50;


    const [{ data, fetching }, refetch] = useQuery({
        query: AllTagsPageDocument,
        variables: {
            limit,
            offset: activePage,
        },
        pause: !limit || !activePage,
    });

    console.log('data', data);

    useEffect(() => {
        setFiltersContext(
            <div className="flex flex-row gap-3">
                <AddTagForm refetch={refetch} />
                <AllTagsPagePagination currentPage={activePage} onPageChange={setActivePage} totalPages={data?.allTagsPaginated.pageInfo.totalPages || 1} />
            </div>,
        );
    }, [activePage, data, refetch, setFiltersContext]);

    useEffect(() => {
        set('page', activePage.toString());
    }, [activePage, set]);

    return (
        <div>
            {fetching ? (
                <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
            ) : (
                <TagsTable data={data?.allTagsPaginated?.nodes} />
            )}
        </div>
    );
};
