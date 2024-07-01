import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { AddTagDocument, AddTagMutationVariables } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddTag($tagName: String!) {
    addTag(name: $tagName)
  }
`;

type UseAddTag = {
  fetching: boolean;
  addTag: (variables: AddTagMutationVariables) => Promise<void>;
};

export const useAddTag = (): UseAddTag => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(AddTagDocument);

  return {
    fetching,
    addTag: (variables: AddTagMutationVariables): Promise<void> =>
      new Promise<void>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error adding new tag [${variables.tagName}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data?.addTag) {
            console.error(`Error adding new tag [${variables.tagName}]`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Tag Added!',
            message: `"${variables.tagName}" tag was successfully added`,
          });
          return resolve();
        }),
      ),
  };
};
