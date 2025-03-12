import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllTagsDocument, AllTagsQuery } from '../gql/graphql.js';
import { sortTags } from '../helpers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllTags {
    allTags {
      id
      name
      namePath
    }
  }
`;

type Tags = Array<NonNullable<AllTagsQuery['allTags']>[number]>;

type UseGetTags = {
  fetching: boolean;
  refresh: () => void;
  tags: Tags;
  selectableTags: Array<{ value: string; label: string; description?: string }>;
};

export const useGetTags = (): UseGetTags => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllTagsDocument,
  });

  if (error) {
    console.error(`Error fetching tags: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch tags',
    });
  }

  const tags = useMemo(() => {
    return sortTags(data?.allTags ?? []);
  }, [data]);

  const selectableTags = useMemo(() => {
    return tags.map(entity => ({
      value: entity.id,
      label: entity.name,
      description: entity.namePath ? `${entity.namePath.join(' > ')} >` : undefined,
    }));
  }, [tags]);

  return {
    fetching,
    refresh: () => fetch(),
    tags,
    selectableTags,
  };
};
