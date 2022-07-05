import { Badge, Image } from '@mantine/core';
import gql from 'graphql-tag';
import { useState } from 'react';

import { GalleryDocumentsFieldsFragment } from '../../../__generated__/types';
import { EditDocument } from './edit-document';

gql`
  fragment GalleryDocumentsFields on Charge {
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
  additionalDocumentsData: GalleryDocumentsFieldsFragment['additionalDocuments'];
};

export const DocumentsGallery = ({ additionalDocumentsData }: Props) => {
  const [openModal, setOpenModal] = useState<string | null>(null);

  return (
    <div className="text-gray-600 body-font">
      <div className="container px-5 py-12 mx-auto">
        {additionalDocumentsData.length > 0 ? (
          <>
            <div className="flex flex-col text-center w-full mb-5">
              <h1 className="text-lg">Realted Documents</h1>
            </div>
            <div className="flex flex-wrap -m-4">
              {additionalDocumentsData.map(doc => (
                <div key={doc.id} className="p-4 md:w-2/4">
                  <button onClick={() => setOpenModal(doc.id)}>
                    <div className="flex rounded-lg h-full bg-gray-100 p-8 flex-col">
                      <h2 className="text-gray-900 text-lg title-font font-medium">
                        {'documentType' in doc ? doc.documentType : 'Unprocessed'}
                      </h2>
                      <Image src={doc.image} className="max-w-[100%] text-gray-900 text-lg title-font font-medium" />
                    </div>
                  </button>
                  {openModal === doc.id && (
                    <EditDocument onClose={() => setOpenModal(null)} opened={openModal === doc.id} documentData={doc} />
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <Badge color="red">No Documents Related</Badge>
        )}
      </div>
    </div>
  );
};
