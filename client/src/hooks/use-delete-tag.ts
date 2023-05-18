import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { DeleteTagDocument, DeleteTagMutationVariables } from '../gql/graphql.js';

/* GraphQL */ `
  mutation DeleteTag($tag: String!) {
    deleteTag(name: $tag)
  }
`;

export const useDeleteTag = () => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(DeleteTagDocument);

  return {
    fetching,
    deleteTag: (variables: DeleteTagMutationVariables) =>
      new Promise<void>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error deleting new tag [${variables.tag}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data?.deleteTag) {
            console.error(`Error deleting new tag [${variables.tag}]`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Tag Deleted!',
            message: `"${variables.tag}" tag was successfully removed`,
          });
          return resolve();
        }),
      ),
  };
};
