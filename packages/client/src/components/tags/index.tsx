import { ReactElement, useCallback, useContext, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { AllTagsScreenDocument } from '../../gql/graphql.js';
import { sortTags } from '../../helpers/index.js';
import { useAddTag } from '../../hooks/use-add-tag.js';
import { useDeleteTag } from '../../hooks/use-delete-tag.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { EditTagModal } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';

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
  const [newTag, setNewTag] = useState('');
  const [{ data, fetching }, refetch] = useQuery({
    query: AllTagsScreenDocument,
  });
  const { addTag } = useAddTag();
  const { deleteTag } = useDeleteTag();

  setFiltersContext(null);

  const allTags = sortTags(data?.allTags ?? []);

  const onAddTag = useCallback(
    (tagName: string) => {
      if (tagName.length > 2) {
        addTag({ tagName }).then(() => {
          refetch();
        });
      }
    },
    [addTag, refetch],
  );
  const onDeleteTag = useCallback(
    (tagId: string, tagName: string) => {
      deleteTag({ tagId, name: tagName }).then(() => {
        refetch();
      });
    },
    [deleteTag, refetch],
  );

  return (
    <PageLayout title="Tags" description="Manage tags for your bookmarks.">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <div className="h-full flex flex-col overflow-hidden">
          {allTags?.map(tag => (
            <div key={tag.id} className="flex items-center gap-2 text-gray-600 mb-2">
              <div className="w-full mt-1 relative rounded-md shadow-xs">
                {tag.namePath?.map((_, i) => (
                  <span key={i} className="ms-2" />
                ))}
                {tag.name}
              </div>
              <EditTagModal data={tag} />
              <Button
                variant="ghost"
                size="icon"
                className="size-7.5"
                onClick={(): void => onDeleteTag(tag.id, tag.name)}
              >
                <TrashX className="size-5" />
              </Button>
            </div>
          ))}
          <div className="flex justify-start items-center gap-2 text-gray-600 mb-2">
            <Input
              className="w-80"
              value={newTag}
              onChange={(event): void => setNewTag(event.currentTarget.value)}
              placeholder="Add new tag"
              required
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-7.5"
              disabled={newTag.length < 2}
              onClick={(): void => onAddTag(newTag)}
            >
              <PlaylistAdd className="size-5" />
            </Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
};
