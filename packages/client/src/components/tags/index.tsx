import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Plus, Search } from 'lucide-react';
import { useQuery } from 'urql';
import { AllTagsScreenDocument } from '../../gql/graphql.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group.js';
import { Spinner } from '../ui/spinner.js';
import { AddTag } from './add-tag.js';
import { TagsList } from './tags-list.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllTagsScreen {
    allTags {
      id
      name
      namePath
      parent {
        id
      }
      ...EditTagFields
    }
  }
`;

export const TagsManager = (): ReactElement => {
  const [search, setSearch] = useState('');
  const { setFiltersContext } = useContext(FiltersContext);
  useEffect(() => {
    setFiltersContext(null);
  }, [setFiltersContext]);

  const [{ data, fetching }, refetch] = useQuery({
    query: AllTagsScreenDocument,
  });

  const tags = useMemo(() => data?.allTags ?? [], [data]);

  if (fetching && tags.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8" />
          <p className="text-muted-foreground text-sm">Loading tags...</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Tags"
      description="Manage your charges tags."
      headerActions={
        <div className="flex items-center gap-2">
          <InputGroup className="max-w-xs">
            <InputGroupInput
              placeholder="Search tags..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ps-10"
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <AddTag
            onDone={async () => {
              await refetch();
            }}
          >
            <Button className="w-full sm:w-auto">
              <Plus className="size-4 me-2" />
              Create Tag
            </Button>
          </AddTag>
        </div>
      }
    >
      <TagsList
        search={search}
        allTags={tags}
        onChange={async () => {
          await refetch();
        }}
      />
    </PageLayout>
  );
};
