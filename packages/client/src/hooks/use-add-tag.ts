import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, VariablesOf } from '../graphql.js';

export const AddTagDocument = graphql(`
  mutation AddTag($tag: String!) {
    addTag(name: $tag)
  }
`);

type AddTagMutationVariables = VariablesOf<typeof AddTagDocument>;

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
            console.error(`Error adding new tag [${variables.tag}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data?.addTag) {
            console.error(`Error adding new tag [${variables.tag}]`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Tag Added!',
            message: `"${variables.tag}" tag was successfully added`,
          });
          return resolve();
        }),
      ),
  };
};
