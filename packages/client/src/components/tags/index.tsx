import { ReactElement, useCallback, useContext, useState } from 'react';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, TextInput } from '@mantine/core';
import { graphql } from '../../graphql.js';
import { useAddTag } from '../../hooks/use-add-tag';
import { useDeleteTag } from '../../hooks/use-delete-tag';
import { FiltersContext } from '../../providers/filters-context';
import { AccounterLoader } from '../common';

export const AllTagsDocument = graphql(`
  query AllTags {
    allTags {
      name
    }
  }
`);

export const TagsManager = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [newTag, setNewTag] = useState('');
  const [{ data, fetching }, refetch] = useQuery({
    query: AllTagsDocument,
  });
  const { addTag } = useAddTag();
  const { deleteTag } = useDeleteTag();

  setFiltersContext(null);

  const allTags = data?.allTags.map(tag => tag.name) ?? [];

  const onAddTag = useCallback(
    (tag: string) => {
      if (tag.length > 2) {
        addTag({ tag }).then(() => {
          refetch();
        });
      }
    },
    [addTag, refetch],
  );
  const onDeleteTag = useCallback(
    (tag: string) => {
      deleteTag({ tag }).then(() => {
        refetch();
      });
    },
    [deleteTag, refetch],
  );

  return (
    <div className="text-gray-600 body-font">
      <div className="container md:px-5 px-2 md:py-12 py-2 mx-auto">
        {fetching ? (
          <AccounterLoader />
        ) : (
          <div className="h-full flex flex-col overflow-hidden">
            <p className="text-red-500">
              Not working ATM :( (as enums are not easily manipulated on SQL DB)
            </p>
            {allTags?.map(tag => (
              <div key={tag} className=" flex items-center gap-2 text-gray-600 mb-2">
                <div className="w-full mt-1 relative rounded-md shadow-sm">{tag}</div>
                <ActionIcon onClick={(): void => onDeleteTag(tag)}>
                  <TrashX size={20} />
                </ActionIcon>
              </div>
            ))}
            <div className=" flex items-center gap-2 text-gray-600 mb-2">
              <div className="w-full mt-1 relative rounded-md shadow-sm">
                <TextInput
                  value={newTag}
                  onChange={(event): void => setNewTag(event.currentTarget.value)}
                  placeholder="Add new tag"
                  withAsterisk
                />
              </div>
              <ActionIcon disabled={newTag.length < 2} onClick={(): void => onAddTag(newTag)}>
                <PlaylistAdd size={20} />
              </ActionIcon>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
