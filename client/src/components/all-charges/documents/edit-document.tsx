import { Image } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import gql from 'graphql-tag';
import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { EditDocumentFieldsFragment, UpdateDocumentFieldsInput } from '../../../__generated__/types';
import { MakeBoolean, relevantDataPicker } from '../../../helpers/form';
import { useUpdateDocument } from '../../../hooks/use-update-document';
import { ButtonWithLabel } from '../../common/button-with-label';
import { PopUpModal } from '../../common/modal';
import { SimpleGrid } from '../../common/simple-grid';
import { ModifyDocumentFields } from './modify-document-fields';

gql`
  fragment EditDocumentFields on Document {
    id
    image
    file
    __typename
    ... on Invoice {
      vat {
        raw
        currency
      }
      serialNumber
      date
      documentType
      amount {
        raw
        currency
      }
    }
    ... on Proforma {
      vat {
        raw
        currency
      }
      serialNumber
      date
      documentType
      amount {
        raw
        currency
      }
    }
    ... on Receipt {
      vat {
        raw
        currency
      }
      serialNumber
      date
      documentType
      amount {
        raw
        currency
      }
    }
    ... on InvoiceReceipt {
      vat {
        raw
        currency
      }
      serialNumber
      date
      documentType
      amount {
        raw
        currency
      }
    }
  }
`;

export interface Props {
  documentData: EditDocumentFieldsFragment;
}

export const EditDocument = ({ documentData }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
    setValue,
    watch,
  } = useForm<UpdateDocumentFieldsInput>({ defaultValues: { ...documentData } });
  const [openModal, setOpenModal] = useState<string | null>(null);

  const { mutate, isLoading, isError, isSuccess } = useUpdateDocument();

  const onSubmit: SubmitHandler<UpdateDocumentFieldsInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (Object.keys(dataToUpdate ?? {}).length > 0) {
      mutate({
        documentId: documentData.id,
        fields: dataToUpdate as UpdateDocumentFieldsInput,
      });
    }
  };

  // auto update vat currency according to amount currency
  useEffect(() => {
    setValue('vat.currency', watch('amount.currency'));
  }, [setValue, watch('amount.currency')]);

  return (
    <>
      <div className="flex flex-row">
        <div className=" px-5 w-4/5 h-max justify-items-center">
          <form onSubmit={handleSubmit(onSubmit)}>
            <SimpleGrid cols={4}>
              <ModifyDocumentFields document={documentData} watch={watch} control={control} />
              <ButtonWithLabel target="_blank" textLabel="File" url={documentData?.file} title="Open Link" />
            </SimpleGrid>
            <div className="flex justify-center mt-5">
              <button
                type="submit"
                className="inline-flex cursor-pointer justify-center py-2 px-4 w-2/12  border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-25"
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
                      message: 'Hey there, your update is awesome!',
                    });
                  }
                }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
        <div className=" w-1/5 h-max flex flex-col ">
          <div className="flex justify-center">
            <Image
              onClick={() => setOpenModal(documentData.image)}
              src={documentData?.image}
              className=" cursor-pointer bg-gray-300 p-5 mr-5 max-h-fit	 max-w-fit"
            />
          </div>
        </div>
      </div>
      {openModal === documentData.image && (
        <PopUpModal
          content={<Image src={documentData.image} className=" bg-gray-300 p-5 mr-5 max-h-fit	 max-w-fit" />}
          modalSize="50%"
          onClose={() => setOpenModal(null)}
          opened={openModal === documentData.image}
        />
      )}
    </>
  );
};
