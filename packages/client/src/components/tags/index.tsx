import { ReactElement, useContext, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { AllTagsScreenDocument } from '../../gql/graphql.js';
import { sortTags } from '../../helpers/index.js';
import { FiltersContext } from '../../providers/filters-context';
import { PageLayout } from '../layout/page-layout.js';
import { AddTagForm } from './add-tag-form.js';
import { columns } from './columns.js';
import { DataTable } from './data-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllTagsScreen {
    allTags {
      id
      name
      namePath
      ...EditTagFields
    }
  }
`;

export const TagsManager = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [{ data, fetching }, refetch] = useQuery({
    query: AllTagsScreenDocument,
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <AddTagForm refetch={refetch} />
      </div>,
    );
  }, [setFiltersContext, refetch]);

  const allTags = sortTags(data?.allTags ?? []);

  return (
    <PageLayout title="Tags" description="Manage tags for your bookmarks.">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <DataTable columns={columns} data={allTags} />
      )}
    </PageLayout>
  );
};
