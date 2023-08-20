import { ReactElement, useState } from 'react';
import { Carousel } from '@mantine/carousel';
import { Badge, Image } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { DocumentsGalleryFieldsFragmentDoc } from '../../../gql/graphql';
import { EditDocumentModal } from '../../common';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentsGalleryFields on Charge {
    id
    additionalDocuments {
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

export const DocumentsGallery = ({ chargeProps }: Props): ReactElement => {
  const { additionalDocuments } = getFragmentData(DocumentsGalleryFieldsFragmentDoc, chargeProps);
  const [openModal, setOpenModal] = useState<string | undefined>(undefined);

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
                    <button className="mx-10" onClick={(): void => setOpenModal(doc.id)}>
                      <div className="flex rounded-lg h-full bg-gray-100 p-2 m-2 flex-col">
                        <Image src={doc.image?.toString()} withPlaceholder />
                      </div>
                    </button>
                  </div>
                </Carousel.Slide>
              ))}
            </Carousel>
          </div>
          <EditDocumentModal documentId={openModal} onDone={(): void => setOpenModal(undefined)} />
        </>
      ) : (
        <Badge color="red">No Documents Related</Badge>
      )}
    </div>
  );
};
