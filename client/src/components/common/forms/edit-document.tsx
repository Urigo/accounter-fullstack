import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Drawer, Image } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { EditDocumentFieldsFragmentDoc, UpdateDocumentFieldsInput } from '../../../gql/graphql';
import { MakeBoolean, relevantDataPicker } from '../../../helpers/form';
import { useUpdateDocument } from '../../../hooks/use-update-document';
import { ButtonWithLabel, SimpleGrid } from '../../common';
import { ImageMagnifier } from '../../common/image-magnifier';
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
      debtor {
        id
        name
      }
      creditor {
        id
        name
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
      debtor {
        id
        name
      }
      creditor {
        id
        name
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
      debtor {
        id
        name
      }
      creditor {
        id
        name
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
      debtor {
        id
        name
      }
      creditor {
        id
        name
      }
    }
  }
`;

interface Props {
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
  const [openImage, setOpenImage] = useState<boolean>(false);

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
              onClick={() => setOpenImage(!!documentData.image)}
              src={documentData?.image?.toString()}
              className=" cursor-pointer bg-gray-300 p-5 mr-5 max-h-fit max-w-fit"
            />
          </div>
        </div>
      </div>
      <Drawer
        className="overflow-y-auto drop-shadow-lg"
        withCloseButton
        withOverlay={false}
        position="right"
        opened={!!documentData.image && openImage}
        onClose={() => setOpenImage(false)}
        // padding={padding}
        size="30%"
      >
        <div className="m-2">
          <ImageMagnifier
            src={documentData.image!.toString()}
            zoomLevel={3}
            magnifierHeight={300}
            magnifierWidth={300}
          />
        </div>
      </Drawer>
    </>
  );
};
