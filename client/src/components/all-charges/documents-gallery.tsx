import { Badge, Image } from '@mantine/core';
import gql from 'graphql-tag';
import { useState } from 'react';

import { GalleryDocumentsFieldsFragment } from '../../__generated__/types';
import { DocumentPopUp } from './documents-pop-up';

gql`
  fragment GalleryDocumentsFields on Charge {
    additionalDocuments {
      id
      image
      file
      __typename
      ... on Unprocessed {
        file
        __typename
      }
      ... on Invoice {
        vat {
          raw
          formatted
        }
        serialNumber
        date
        amount {
          raw
          formatted
        }
        __typename
      }
      ... on Proforma {
        vat {
          raw
          formatted
        }
        serialNumber
        date
        amount {
          raw
          formatted
        }
        __typename
      }
      ... on Receipt {
        vat {
          raw
          formatted
        }
        serialNumber
        date
        amount {
          raw
          formatted
        }
        __typename
      }
      ... on InvoiceReceipt {
        vat {
          raw
          formatted
        }
        serialNumber
        date
        amount {
          raw
          formatted
        }
        __typename
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
                      <h2 className="text-gray-900 text-lg title-font font-medium">{doc.__typename}</h2>
                      <Image src={doc.image} className="max-w-[100%] text-gray-900 text-lg title-font font-medium" />
                    </div>
                  </button>
                  <DocumentPopUp onClose={() => setOpenModal(null)} opened={openModal === doc.id} documentData={doc} />
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
