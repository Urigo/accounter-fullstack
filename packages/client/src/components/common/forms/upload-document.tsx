import { ReactElement, useCallback, useState } from 'react';
import { useMutation } from 'urql';
import { FileInput, Loader } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { CommonError, UploadDocumentDocument } from '../../../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UploadDocument($file: FileScalar!, $chargeId: UUID) {
    uploadDocument(file: $file, chargeId: $chargeId) {
      __typename
      ... on UploadDocumentSuccessfulResult {
        document {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Props = {
  chargeId: string;
  closeModal: () => void;
  onChange?: () => void;
};

export const UploadDocument = ({ chargeId, closeModal, onChange }: Props): ReactElement => {
  const [res, mutate] = useMutation(UploadDocumentDocument);
  const [value, setValue] = useState<File | null>(null);

  const onSubmit = useCallback(async () => {
    if (value) {
      mutate({
        file: value,
        chargeId,
      })
        .then(res => {
          if (res.error || res.data?.uploadDocument.__typename === 'CommonError') {
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            console.error(
              `Error uploading document: ${
                res.error?.message || (res.data?.uploadDocument as CommonError).message
              }`,
            );
          } else if (res.data) {
            onChange?.();
            showNotification({
              title: 'Upload Success!',
              message: 'Hey there, you add new document!',
            });
            closeModal();
          }
        })
        .catch(e => {
          showNotification({
            title: 'Error!',
            message: 'Oh no!, we have an error! 🤥',
          });
          console.error(`Error uploading document: ${(e as Error)?.message}`);
        });
    }
  }, [mutate, closeModal, onChange, value, chargeId]);

  return (
    <div className="px-5 w-max h-max justify-items-center">
      <FileInput
        icon={res.fetching && <Loader />}
        value={value}
        onChange={setValue}
        clearable
        label="File Upload"
      />
      <div className="flex justify-center gap-5 mt-5">
        <button
          type="submit"
          className=" text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
          disabled={res.fetching || !value}
          onClick={onSubmit}
        >
          Accept
        </button>
        <button
          type="button"
          className=" text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
          onClick={closeModal}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
