import { useCallback, useState } from 'react';
import { FileInput, Loader } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useMutation } from 'urql';
import {
  CommonError,
  UploadDocumentDocument,
  UploadDocumentMutation,
  UploadDocumentMutationVariables,
} from '../../../__generated__/types';

type Props = {
  chargeId: string;
  closeModal?: () => void;
};

export const UploadDocument = ({ chargeId, closeModal }: Props) => {
  const [res, mutate] = useMutation<UploadDocumentMutation, UploadDocumentMutationVariables>(
    UploadDocumentDocument,
  );
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
            showNotification({
              title: 'Upload Success!',
              message: 'Hey there, you add new document!',
            });
            console.log(res.data.uploadDocument);
            if (closeModal) {
              closeModal();
            }
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
  }, [mutate, closeModal, value, chargeId]);

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
