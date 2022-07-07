import { SimpleGrid } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { DocumentType, InsertDocumentInput } from '../../../__generated__/types';
import { useInsertDocument } from '../../../hooks/use-insert-document';
import { ModifyDocumentFields } from './modify-document-fields';

type Props = {
  chargeId: string;
  closeModal?: () => void;
};

export const InsertDocument = ({ chargeId, closeModal }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
    setValue,
    watch,
  } = useForm<InsertDocumentInput>();
  const { mutate, isLoading, isError, isSuccess } = useInsertDocument();

  const onSubmit: SubmitHandler<InsertDocumentInput> = data => {
    if (data && Object.keys(data).length > 0) {
      mutate({
        record: { ...data, chargeId },
      });
      if (closeModal) {
        closeModal();
      }
    }
  };

  setValue('documentType', DocumentType.Unprocessed, { shouldDirty: true });

  // auto update vat currency according to amount currency
  useEffect(() => {
    setValue('vat.currency', watch('amount.currency'));
  }, [setValue, watch('amount.currency')]);

  return (
    <div className=" px-5 w-max h-max justify-items-center">
      <form onSubmit={handleSubmit(onSubmit)}>
        <SimpleGrid cols={5}>
          <ModifyDocumentFields control={control} />
        </SimpleGrid>
        <div className="flex justify-center gap-5 mt-5">
          <button
            type="submit"
            className=" text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            disabled={isLoading || Object.keys(dirtyFields).length === 0}
            onClick={() => {
              if (isError) {
                showNotification({
                  title: 'Error!',
                  message: 'Oh no!, we have an error! 🤥',
                });
              }
              if (isSuccess) {
                showNotification({
                  title: 'Update Success!',
                  message: 'Hey there, you add new document!',
                });
              }
            }}
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
      </form>
    </div>
  );
};
