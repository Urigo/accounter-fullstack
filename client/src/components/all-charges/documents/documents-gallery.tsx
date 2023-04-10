import { useState } from 'react';
import { Carousel } from '@mantine/carousel';
import { Badge, Image } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { DocumentsGalleryFieldsFragmentDoc } from '../../../gql/graphql';
import { EditDocument, PopUpDrawer } from '../../common';
import { DeleteDocumentButton } from './delete-document-button';
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
    <div className="container mx-auto text-gray-600 body-font">
      {additionalDocuments.length > 0 ? (
        <>
          <div className="flex flex-wrap">
            <Carousel
              sx={{ maxWidth: 320 }}
              mx="auto"
              align="center"
              withControls={additionalDocuments.length > 1}
              slideGap={0}
              withIndicators
              className="[&>*>.mantine-Carousel-indicator]:bg-gray-500"
            >
              {additionalDocuments.map(doc => (
                <Carousel.Slide key={doc.id}>
                  <div className="flex flex-col items-center">
                    <h2 className="text-gray-900 text-base font-medium">
                      {'documentType' in doc ? doc.documentType : 'Unprocessed'}
                    </h2>
                    <button className="mx-10" onClick={() => setOpenModal(doc.id)}>
                      <div className="flex rounded-lg h-full bg-gray-100 p-2 m-2 flex-col">
                        <Image src={doc.image?.toString()} withPlaceholder />
                      </div>
                    </button>
                  </div>
                </Carousel.Slide>
              ))}
            </Carousel>
          </div>
          {openModal && (
            <PopUpDrawer
              modalSize="40%"
              position="bottom"
              opened
              onClose={() => setOpenModal(null)}
              title={
                <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-5">
                  <h1 className="sm:text-2xl font-small text-gray-900">Edit Documents</h1>
                  <a href="/#" className="pt-1">
                    ID: {openModal}
                  </a>
                  <UnlinkDocumentButton documentId={openModal} />
                  <DeleteDocumentButton documentId={openModal} />
                </div>
              }
            >
              <EditDocument documentProps={additionalDocuments.find(d => d.id === openModal)!} />
            </PopUpDrawer>
          )}
        </>
      ) : (
        <Badge color="red">No Documents Related</Badge>
      )}
    </div>
  );
};
