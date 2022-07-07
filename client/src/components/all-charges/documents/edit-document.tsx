import { Modal } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import gql from 'graphql-tag';
import { CSSProperties, ReactNode, useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { EditDocumentFieldsFragment, UpdateDocumentFieldsInput } from '../../../__generated__/types';
import { MakeBoolean, relevantDataPicker } from '../../../helpers/form';
import { useUpdateDocument } from '../../../hooks/use-update-document';
import { ButtonWithLabel } from '../../common/button-with-label';
import { ModifyDocumentFields } from './modify-document-fields';
import { UnlinkDocumentButton } from './unlink-document-button';

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
  style?: CSSProperties;
  opened: boolean;
  onClose: () => void;
  documentData: EditDocumentFieldsFragment;
  content?: ReactNode;
}

export const EditDocument = ({ opened, onClose, documentData }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
    setValue,
    watch,
  } = useForm<UpdateDocumentFieldsInput>({ defaultValues: { ...documentData } });

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
    <Modal
      size="70%"
      opened={opened}
      onClose={onClose}
      title={
        <>
          <h1 className="title-font sm:text-4xl text-3xl mb-4 font-medium text-gray-900">Edit Documents</h1>
          <p>ID: {documentData.id}</p>
        </>
      }
    >
      <div style={{ flexDirection: 'row', display: 'flex', gap: 10 }}>
        <div style={{ width: '50%', flexDirection: 'column' }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="shadow p-3 sm:rounded-md sm:overflow-hidden">
              <ModifyDocumentFields document={documentData} control={control} />
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 flex flex-row">
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                <UnlinkDocumentButton documentId={documentData.id} />
              </div>
            </div>
          </form>
          <ButtonWithLabel target="_blank" textLabel="File" url={documentData?.file} title="Open Link" />
        </div>
        {documentData?.image && (
          <div style={{ width: '50%', flexDirection: 'column' }}>
            <div className="container mx-auto flex  md:flex-row flex-col items-right">
              <img className="object-cover object-center rounded" alt={documentData.image} src={documentData.image} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
