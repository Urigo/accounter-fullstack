import { ReactElement, useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Drawer, Image, Loader } from '@mantine/core';
import { EditDocumentDocument, UpdateDocumentFieldsInput } from '../../../gql/graphql.js';
import { MakeBoolean, relevantDataPicker } from '../../../helpers/form.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { ButtonWithLabel, ImageMagnifier, SimpleGrid } from '../index.js';
import { ModifyDocumentFields } from './modify-document-fields.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditDocument($documentId: UUID!) {
    documentById(documentId: $documentId) {
      id
      image
      file
      documentType
      __typename
      ... on FinancialDocument {
        vat {
          raw
          currency
        }
        serialNumber
        date
        amount {
          raw
          currency
        }
        debtor {
          id
          name
        }
        creditor {
          id
          name
        }
        vatReportDateOverride
        noVatAmount
      }
    }
  }
`;

interface Props {
  documentId: string;
  onDone: () => void;
  onChange: () => void;
}

export const EditDocument = ({ documentId, onDone, onChange }: Props): ReactElement => {
  const [{ data: documentData, fetching: fetchingDocument }] = useQuery({
    query: EditDocumentDocument,
    variables: {
      documentId,
    },
  });

  const document = documentData?.documentById;
  const formManager = useForm<UpdateDocumentFieldsInput>({ defaultValues: { ...document } });
  const {
    handleSubmit,
    formState: { dirtyFields },
    setValue,
    watch,
  } = formManager;
  const [openImage, setOpenImage] = useState<boolean>(false);

  const { updateDocument, fetching } = useUpdateDocument();

  const onSubmit: SubmitHandler<UpdateDocumentFieldsInput> = data => {
    if (!document) {
      return;
    }

    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    onDone?.();
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateDocument({
        documentId,
        fields: dataToUpdate,
      }).then(onChange);
    }
  };

  const amountCurrency = watch('amount.currency');

  // auto update vat currency according to amount currency
  useEffect(() => {
    setValue('vat.currency', amountCurrency);
  }, [setValue, amountCurrency]);

  return (
    <div className="flex flex-row">
      {fetchingDocument && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {!fetchingDocument && document && (
        <>
          <div className="px-5 w-4/5 h-max justify-items-center">
            <form onSubmit={handleSubmit(onSubmit)}>
              <SimpleGrid cols={4}>
                <ModifyDocumentFields document={document} formManager={formManager} />
                <ButtonWithLabel
                  target="_blank"
                  textLabel="File"
                  url={document?.file?.toString()}
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
                onClick={(): void => setOpenImage(!!document.image)}
                src={document?.image?.toString()}
                className=" cursor-pointer bg-gray-300 p-5 mr-5 max-h-fit max-w-fit"
              />
            </div>
          </div>
          {document.image && (
            <Drawer
              classNames={{ content: 'overflow-y-auto drop-shadow-lg' }}
              withCloseButton
              withOverlay={false}
              position="right"
              opened={openImage}
              onClose={(): void => setOpenImage(false)}
              size="30%"
            >
              <div className="m-2">
                <ImageMagnifier
                  src={document.image!.toString()}
                  zoomLevel={3}
                  magnifierHeight={300}
                  magnifierWidth={300}
                />
              </div>
            </Drawer>
          )}
        </>
      )}
    </div>
  );
};
