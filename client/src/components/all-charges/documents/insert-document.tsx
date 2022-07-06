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
  const { mutate, isLoading } = useInsertDocument();

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
    <form className="text-gray-600 body-font" onSubmit={handleSubmit(onSubmit)}>
      <div className="container px-5 py-24 mx-auto">
        <div className="text-center mb-20">
          <h1 className="sm:text-3xl text-2xl font-medium text-center title-font text-gray-900 mb-4">
            Insert Document
          </h1>
          <p>to charge ID: {chargeId}</p>
        </div>
        <div className="flex flex-wrap lg:w-4/5 sm:mx-auto sm:mb-2 -mx-2">
          <ModifyDocumentFields control={control} />
        </div>
        <div className="container flex justify-center gap-20">
          <button
            type="submit"
            className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            disabled={isLoading || Object.keys(dirtyFields).length === 0}
          >
            Accept
          </button>
          <button
            type="button"
            className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
            onClick={closeModal}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
};
