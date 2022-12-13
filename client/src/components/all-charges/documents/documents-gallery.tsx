import { useState } from 'react';
import { Carousel } from '@mantine/carousel';
import { Badge, Image } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { DocumentsGalleryFieldsFragmentDoc } from '../../../gql/graphql';
import { PopUpDrawer } from '../../common';
import { DeleteDocumentButton } from './delete-document-button';
import { EditDocument } from './edit-document';
import { UnlinkDocumentButton } from './unlink-document-button';

/* GraphQL */ `
  fragment DocumentsGalleryFields on Charge {
    id
    additionalDocuments {
      ...EditDocumentFields
      id
      image
      ... on Invoice {
        documentType
      }
      ... on Proforma {
        documentType
      }
      ... on Receipt {
        documentType
      }
      ... on InvoiceReceipt {
        documentType
      }
    }
  }
`;

type Props = {
  chargeProps: FragmentType<typeof DocumentsGalleryFieldsFragmentDoc>;
};

export const DocumentsGallery = ({ chargeProps }: Props) => {
  const { additionalDocuments } = getFragmentData(DocumentsGalleryFieldsFragmentDoc, chargeProps);
  const [openModal, setOpenModal] = useState<string | null>(null);

  return (
    <div className="container px-3 py-3 mx-auto text-gray-600 body-font">
      {additionalDocuments.length > 0 ? (
        <>
          <div className="flex flex-col text-center w-full mb-5">
            <h1 className="text-lg">Realted Documents</h1>
          </div>
          <div className="flex flex-wrap -m-4">
            <Carousel sx={{ maxWidth: 320 }} mx="auto" withIndicators height="100%">
              {additionalDocuments.map(doc => (
                <Carousel.Slide key={doc.id}>
                  <h2 className="text-gray-900 text-lg title-font font-medium">
                    {'documentType' in doc ? doc.documentType : 'Unprocessed'}
                  </h2>
                  <div key={doc.id} className="p-4 md:w-2/4">
                    <button onClick={() => setOpenModal(doc.id)}>
                      <div className="flex rounded-lg h-full bg-gray-100 p-8 flex-col">
                        <Image
                          src={doc.image?.toString()}
                          className="max-w-[100%]"
                          withPlaceholder
                        />
                      </div>
                    </button>
                  </div>
                  {openModal === doc.id && (
                    <PopUpDrawer
                      modalSize="40%"
                      position="bottom"
                      opened={openModal === doc.id}
                      onClose={() => setOpenModal(null)}
                      title={
                        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-5">
                          <h1 className="sm:text-2xl font-small text-gray-900">Edit Documents</h1>
                          <a href="/#" className="pt-1">
                            ID: {doc.id}
                          </a>
                          <UnlinkDocumentButton documentId={doc.id} />
                          <DeleteDocumentButton documentId={doc.id} />
                        </div>
                      }
                    >
                      <EditDocument documentProps={doc} />
                    </PopUpDrawer>
                  )}
                </Carousel.Slide>
              ))}
            </Carousel>
          </div>
        </>
      ) : (
        <Badge color="red">No Documents Related</Badge>
      )}
    </div>
  );
};
