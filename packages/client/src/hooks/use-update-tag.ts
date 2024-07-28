import { useMutation } from 'urql';
import { useToast } from '../components/ui/use-toast.js';
import { UpdateTagDocument, UpdateTagMutationVariables } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateTag($tagId: UUID!, $fields: UpdateTagFieldsInput!) {
    updateTag(id: $tagId, fields: $fields)
  }
`;

type UseUpdateTag = {
  fetching: boolean;
  updateTag: (variables: UpdateTagMutationVariables) => Promise<boolean>;
};

export const useUpdateTag = (): UseUpdateTag => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateTagDocument);
  const { toast } = useToast();

  return {
    fetching,
    updateTag: (variables: UpdateTagMutationVariables): Promise<boolean> =>
      new Promise<boolean>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error updating tag ID [${variables.tagId}]: ${res.error}`);
            toast({
              title: 'Error!',
              description: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (res.data?.updateTag !== true) {
            console.error(`Error updating tag ID [${variables.tagId}]: No data returned`);
            toast({
              title: 'Error!',
              description: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          toast({
            title: 'Update Success!',
            description: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.updateTag);
        }),
      ),
  };
};
