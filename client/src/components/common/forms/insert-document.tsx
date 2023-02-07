import { useEffect } from 'react';
import { showNotification } from '@mantine/notifications';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Currency, DocumentType, InsertDocumentInput } from '../../../gql/graphql';
import { useInsertDocument } from '../../../hooks/use-insert-document';
import { SimpleGrid } from '..';
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
    getValues,
    setValue,
    watch,
  } = useForm<InsertDocumentInput>();
  const { insertDocument, fetching } = useInsertDocument();

  const onSubmit: SubmitHandler<InsertDocumentInput> = data => {
    if (data && Object.keys(data).length > 0) {
      if (data.vat) {
        if (!data.amount?.currency) {
          showNotification({
            title: 'Error!',
            message: "Couldn't figure out the currency of the document",
          });
          return;
        }
        data.vat.currency = data.amount.currency;
      }
      insertDocument({
        record: { ...data, chargeId },
      });
      if (closeModal) {
        closeModal();
      }
    }
  };

  if (!getValues('documentType')) {
    setValue('documentType', DocumentType.Unprocessed, { shouldDirty: true });
  }

  const currency = watch('amount.currency');

  // auto update vat currency according to amount currency
  useEffect(() => {
    setValue('vat.currency', currency);
  }, [setValue, currency]);

  return (
    <div className=" px-5 w-max h-max justify-items-center">
      <form onSubmit={handleSubmit(onSubmit)}>
        <SimpleGrid cols={5}>
          <ModifyDocumentFields control={control} watch={watch} defaultCurrency={Currency.Ils} />
        </SimpleGrid>
        <div className="flex justify-center gap-5 mt-5">
          <button
            type="submit"
            className=" text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            disabled={fetching || Object.keys(dirtyFields).length === 0}
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
