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
  query AllTagsPage($limit: Int!, $page: Int!) {
    allTagsPaginated(limit: $limit, page: $page) {
      nodes {
        ...AllTabsTableFields
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
        totalPages
      }
    }
  }
`;

export const TagsPage = (): ReactElement => {
    const { setFiltersContext } = useContext(FiltersContext);

    const { get, set } = useUrlQuery();
    const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 1);
    const limit = 25;

    const [{ data, fetching }, refetch] = useQuery({
        query: AllTagsPageDocument,
        variables: {
            limit,
            page: activePage,
        },
    });

    useEffect(() => {
        setFiltersContext(
            <div className="flex flex-row gap-3">
                <AddTagForm refetch={refetch} />
                <AllTagsPagePagination
                    fetching={fetching}
                    get={get}
                    set={set}
                    currentPage={activePage}
                    onPageChange={(page) => {
                        setActivePage(page);
                        set('page', page.toString());
                    }}
                    totalPages={data?.allTagsPaginated.pageInfo.totalPages || 1}
                />
            </div>,
        );
    }, [activePage, refetch, setFiltersContext, set, data?.allTagsPaginated.pageInfo.totalPages, get, fetching]);

    return (
        <div>
            {fetching ? (
                <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
            ) : (
                <TagsTable refetch={refetch} data={data?.allTagsPaginated?.nodes} />
            )}
        </div>
    );
};
