import { ReactElement, useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { showNotification } from '@mantine/notifications';
import { Currency, DocumentType, InsertDocumentInput } from '../../../gql/graphql.js';
import { useInsertDocument } from '../../../hooks/use-insert-document.js';
import { SimpleGrid } from '../index.js';
import { ModifyDocumentFields } from './modify-document-fields.js';

type Props = {
  chargeId: string;
  onChange: () => void;
  closeModal?: () => void;
};

export const InsertDocument = ({ chargeId, onChange, closeModal }: Props): ReactElement => {
  const formManager = useForm<InsertDocumentInput>();
  const {
    handleSubmit,
    formState: { dirtyFields },
    setValue,
    watch,
  } = formManager;
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
      data.documentType ??= DocumentType.Unprocessed;
      insertDocument({
        record: { ...data, chargeId },
      }).then(() => onChange?.());
      closeModal?.();
    }
  };

  const currency = watch('amount.currency');

  // auto update vat currency according to amount currency
  useEffect(() => {
    setValue('vat.currency', currency);
  }, [setValue, currency]);

  return (
    <div className=" px-5 w-max h-max justify-items-center">
      <form onSubmit={handleSubmit(onSubmit)}>
        <SimpleGrid cols={5}>
          <ModifyDocumentFields formManager={formManager} defaultCurrency={Currency.Ils} />
        </SimpleGrid>
        <div className="flex justify-center gap-5 mt-5">
          <button
            type="submit"
            className=" text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
            disabled={fetching || Object.keys(dirtyFields).length === 0}
          >
            Accept
          </button>
          <button
            type="button"
            className=" text-white bg-rose-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-rose-600 rounded-sm text-lg"
            onClick={closeModal}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
