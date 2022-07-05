import { ActionIcon, Modal } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import gql from 'graphql-tag';
import { CSSProperties, ReactNode } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import {
  Currency,
  DocumentType,
  ModalDocumentsFieldsFragment,
  UpdateDocumentFieldsInput,
} from '../../__generated__/types';
import { TIMELESS_DATE_REGEX } from '../../helpers/consts';
import {
  isDocumentInvoice,
  isDocumentInvoiceReceipt,
  isDocumentProforma,
  isDocumentReceipt,
} from '../../helpers/documents';
import { MakeBoolean, relevantDataPicker } from '../../helpers/form';
import { useUpdateDocument } from '../../hooks/use-update-document';
import { ButtonWithLabel } from '../common/button-with-label';
import { CurrencyInput, SelectInput, TextInput } from '../common/inputs';
import { File } from 'tabler-icons-react';

gql`
  fragment ModalDocumentsFields on Charge {
    additionalDocuments {
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
  }
`;

export interface Props {
  style?: CSSProperties;
  opened: boolean;
  onClose: () => void;
  documentData: ModalDocumentsFieldsFragment['additionalDocuments']['0'];
  content?: ReactNode;
}

export const DocumentPopUp = ({ opened, onClose, documentData }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<Partial<UpdateDocumentFieldsInput>>({ defaultValues: { ...documentData } });

  const { mutate, isLoading, isError, isSuccess } = useUpdateDocument();

  const onSubmit: SubmitHandler<Partial<UpdateDocumentFieldsInput>> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (Object.keys(dataToUpdate ?? {}).length > 0) {
      mutate({
        documentId: documentData.id,
        fields: dataToUpdate as UpdateDocumentFieldsInput,
      });
    }
  };

  const isDocumentProcessed =
    isDocumentInvoice(documentData) ||
    isDocumentReceipt(documentData) ||
    isDocumentInvoiceReceipt(documentData) ||
    isDocumentProforma(documentData);

  return (
    <Modal
      size="70%"
      opened={opened}
      onClose={onClose}
      title={<h1 className="title-font sm:text-4xl text-3xl mb-4 font-medium text-gray-900">Edit Documents</h1>}
    >
      <div style={{ flexDirection: 'row', display: 'flex', gap: 10 }}>
        <div style={{ width: '50%', flexDirection: 'column' }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="shadow p-3 sm:rounded-md sm:overflow-hidden">
              <Controller
                name="documentType"
                control={control}
                rules={{ required: 'Required' }}
                render={({ field, fieldState }) => (
                  <SelectInput {...field} selectionEnum={DocumentType} error={fieldState.error?.message} label="Type" />
                )}
              />
              {isDocumentProcessed && (
                <>
                  <Controller
                    name="date"
                    control={control}
                    defaultValue={documentData.date}
                    rules={{
                      required: 'Required',
                      pattern: {
                        value: TIMELESS_DATE_REGEX,
                        message: 'Date must be im format yyyy-mm-dd',
                      },
                    }}
                    render={({ field, fieldState }) => (
                      <TextInput {...field} error={fieldState.error?.message} label="Date" />
                    )}
                  />
                  <Controller
                    name="serialNumber"
                    control={control}
                    defaultValue={documentData.serialNumber}
                    rules={{ required: 'Required' }}
                    render={({ field, fieldState }) => (
                      <TextInput
                        {...field}
                        value={!field || field.value === 'Missing' ? '' : field.value!}
                        error={fieldState.error?.message}
                        label="Serial Number"
                      />
                    )}
                  />
                  <Controller
                    name="vat.raw"
                    control={control}
                    defaultValue={documentData.vat?.raw}
                    render={({ field: vatField, fieldState: vatFieldState }) => (
                      <Controller
                        name="amount.currency"
                        control={control}
                        defaultValue={documentData.amount?.currency ?? Currency.Ils}
                        render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                          <CurrencyInput
                            // className="w-full bg-gray-100 rounded border bg-opacity-50 border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                            {...vatField}
                            error={vatFieldState.error?.message || currencyCodeFieldState.error?.message}
                            label="VAT"
                            currencyCodeProps={{ ...currencyCodeField, label: 'Currency', disabled: true }}
                          />
                        )}
                      />
                    )}
                  />
                  <Controller
                    name="amount.raw"
                    control={control}
                    defaultValue={documentData.amount?.raw}
                    render={({ field: amountField, fieldState: amountFieldState }) => (
                      <Controller
                        name="amount.currency"
                        control={control}
                        defaultValue={documentData.amount?.currency}
                        render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                          <CurrencyInput
                            // className="w-full bg-gray-100 rounded border bg-opacity-50 border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                            {...amountField}
                            error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                            label="Amount"
                            currencyCodeProps={{ ...currencyCodeField, label: 'Currency' }}
                          />
                        )}
                      />
                    )}
                  />
                </>
              )}
              <Controller
                name="image"
                control={control}
                defaultValue={documentData.image}
                rules={{
                  required: 'Required',
                }}
                render={({ field, fieldState }) => (
                  <TextInput {...field} error={fieldState.error?.message} label="Image URL" />
                )}
              />
              <Controller
                name="file"
                control={control}
                defaultValue={documentData.file}
                rules={{
                  required: 'Required',
                }}
                render={({ field, fieldState }) => (
                  <div className="flex flex-row gap-1 w-full">
                    <TextInput className="grow" {...field} error={fieldState.error?.message} label="File URL" />
                    <ActionIcon variant="hover">
                      <a rel="noreferrer" target="_blank" href={field.value} type="button">
                        <File size={20} />
                      </a>
                    </ActionIcon>
                  </div>
                )}
              />
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
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
