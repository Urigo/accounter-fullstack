import { useEffect, useState } from 'react';
import { Image } from '@mantine/core';
import { SubmitHandler, useForm } from 'react-hook-form';
import { FragmentType, getFragmentData } from '../../../gql';
import { EditDocumentFieldsFragmentDoc, UpdateDocumentFieldsInput } from '../../../gql/graphql';
import { MakeBoolean, relevantDataPicker } from '../../../helpers/form';
import { useUpdateDocument } from '../../../hooks/use-update-document';
import { ButtonWithLabel } from '../../common/button-with-label';
import { PopUpModal } from '../../common/modal';
import { SimpleGrid } from '../../common/simple-grid';
import { ModifyDocumentFields } from './modify-document-fields';

/* GraphQL */ `
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
  documentProps: FragmentType<typeof EditDocumentFieldsFragmentDoc>;
}

export const EditDocument = ({ documentProps }: Props) => {
  const documentData = getFragmentData(EditDocumentFieldsFragmentDoc, documentProps);
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
    setValue,
    watch,
  } = useForm<UpdateDocumentFieldsInput>({ defaultValues: { ...documentData } });
  const [openModal, setOpenModal] = useState<string | null>(null);

  const { updateDocument, fetching } = useUpdateDocument();

  const onSubmit: SubmitHandler<UpdateDocumentFieldsInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (Object.keys(dataToUpdate ?? {}).length > 0) {
      updateDocument({
        documentId: documentData.id,
        fields: dataToUpdate as UpdateDocumentFieldsInput,
      });
    }
  };

  const amountCurrency = watch('amount.currency');

  // auto update vat currency according to amount currency
  useEffect(() => {
    setValue('vat.currency', amountCurrency);
  }, [setValue, amountCurrency]);

  return (
    <>
      <div className="flex flex-row">
        <div className=" px-5 w-4/5 h-max justify-items-center">
          <form onSubmit={handleSubmit(onSubmit)}>
            <SimpleGrid cols={4}>
              <ModifyDocumentFields document={documentData} watch={watch} control={control} />
              <ButtonWithLabel
                target="_blank"
                textLabel="File"
                url={documentData?.file?.toString()}
                title="Open Link"
              />
            </SimpleGrid>
            <div className="flex justify-center mt-5">
              <button
                type="submit"
                className="inline-flex cursor-pointer justify-center py-2 px-4 w-2/12  border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={fetching || Object.keys(dirtyFields).length === 0}
              >
                Save
              </button>
            </div>
          </form>
        </div>
        <div className=" w-1/5 h-max flex flex-col ">
          <div className="flex justify-center">
            <Image
              onClick={() => setOpenModal(documentData.image?.toString() ?? null)}
              src={documentData?.image?.toString()}
              className=" cursor-pointer bg-gray-300 p-5 mr-5 max-h-fit	 max-w-fit"
            />
          </div>
        </div>
      </div>
      {openModal === documentData.image && (
        <PopUpModal
          content={
            <Image src={documentData.image} className=" bg-gray-300 p-5 mr-5 max-h-fit	 max-w-fit" />
          }
          modalSize="50%"
          onClose={() => setOpenModal(null)}
          opened={openModal === documentData.image}
        />
      )}
    </>
  );
};
